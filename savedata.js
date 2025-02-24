let saveSyncConfig = {
  enabled: false,
  slotId: 0
};

function initSaveSyncControls() {
  document.getElementById('saveSyncButton').onclick = function () {
    setSaveSyncEnabled(!this.classList.contains('toggled'));
  };

  const saveSyncSlotSelect = document.getElementById('saveSyncSlotId');
  for (let s = 1; s <= 15; s++) {
    const slotOption = document.createElement('option');
    slotOption.innerText = s;
    saveSyncSlotSelect.appendChild(slotOption);
  }

  document.getElementById('saveSyncSlotId').onchange = function () {
    saveSyncConfig.slotId = this.value;
    updateConfig(saveSyncConfig, false, 'saveSyncConfig');
    if (this.value) {
      const getSaveSyncData = timestamp => {
        getSaveDataForSync().then(saveData => {
          if (saveData && (!timestamp || saveData.timestamp > new Date(timestamp)))
            uploadSaveSyncData(saveData).then(success => {
              if (success)
                document.getElementById('clearSaveSyncButton').removeAttribute('disabled');
            });
        });
      };
      hasSaveDataForSync().then(hasSaveData => {
        if (hasSaveData) {
          apiFetch('savesync?command=timestamp')
            .then(response => {
              if (!response.ok)
                return getSaveSyncData(null);
              return response.text();
            })
            .then(timestamp => getSaveSyncData(timestamp))
            .catch(err => console.error(err));
        }
      });
    }
  };

  document.getElementById('clearSaveSyncButton').onclick = function () {
    const button = this;
    clearSaveSyncData().then(success => {
      if (success)
        button.setAttribute('disabled', true);
    })
  };

  if (getCookie(sessionIdKey)) {
    apiFetch('savesync?command=timestamp')
      .then(response => {
        if (!response.ok)
          throw new Error('Failed to retrieve timestamp for save sync data');
        return response.text();
      })
      .then(timestamp => {
        const clearSaveSyncButton = document.getElementById('clearSaveSyncButton');
        if (timestamp)
          clearSaveSyncButton.removeAttribute('disabled');
        else
          clearSaveSyncButton.setAttribute('disabled', true);
      });
  }
}

function initSaveDataControls() {
  document.getElementById('saveButton').onclick = () => {
    updateSaveSlotList();

    openModal('saveModal');
  };

  document.getElementById('saveModalReloadButton').onclick = () => window.location = window.location;
}

function updateSaveSlotList() {
  const saveSlotList = document.getElementById('saveSlotList');
  saveSlotList.innerHTML = '';

  for (let s = 1; s <= 15; s++) {
    saveSlotList.appendChild(getSaveSlotListEntry(s));
  }
}

function getSaveSlotListEntry(slotId) {
  const slot = document.createElement('div');
  slot.classList.add('saveSlotListEntry', 'listEntry');
  slot.dataset.slotId = slotId;
  updateThemedContainer(slot);

  const title = document.createElement('label');
  title.innerHTML = getMassagedLabel(localizedMessages.save.slot.title, true).replace('{SLOT_ID}', slotId);

  slot.appendChild(title);

  const content = document.createElement('div');
  content.classList.add('saveSlotListEntryContent');

  const contentLabel = document.createElement('label');
  contentLabel.innerHTML = getMassagedLabel(localizedMessages.save.slot.readingLabel, true);

  content.appendChild(contentLabel);

  const buttonsContainer = document.createElement('div');
  buttonsContainer.classList.add('saveSlotButtonsContainer');

  const uploadButton = getSvgIcon('saveUpload');
  
  uploadButton.classList.add('saveSlotUploadButton', 'saveSlotButton', 'unselectable', 'iconButton');
  uploadButton.onclick = () => {
    let saveFile = document.getElementById('saveFile');
    if (saveFile)
      saveFile.remove();
  
    saveFile = document.createElement('input');
    saveFile.type = 'file';
    saveFile.id = 'saveFile';
    saveFile.style.display = 'none';
    saveFile.addEventListener('change',
      e => uploadSaveFile(e.target.files[0], formatSaveSlotId(slotId))
        .then(success => {
          const reloadButton = document.getElementById('saveModalReloadButton');
          if (success) {
            if (reloadButton.classList.contains('hidden'))
              setTimeout(() => reloadButton.classList.remove('hidden'), 100);
            slot.insertAdjacentElement('afterend', getSaveSlotListEntry(slotId));
            slot.remove();
          }
        })
    );
    saveFile.click();
  };
  addTooltip(uploadButton, getMassagedLabel(localizedMessages.save.upload.tooltip, true), true, true);

  const downloadButton = getSvgIcon('saveDownload');
  downloadButton.classList.add('saveSlotDownloadButton', 'saveSlotButton', 'unselectable', 'iconButton', 'hidden');
  downloadButton.onclick = () => downloadSaveFile(formatSaveSlotId(slotId));
  addTooltip(downloadButton, getMassagedLabel(localizedMessages.save.download.tooltip, true), true, true);

  const deleteButton = getSvgIcon('delete');
  deleteButton.classList.add('saveSlotDeleteButton', 'saveSlotButton', 'unselectable', 'iconButton', 'hidden');
  deleteButton.onclick = () => deleteSaveFile(formatSaveSlotId(slotId))
    .then(success => {
      const reloadButton = document.getElementById('saveModalReloadButton');
      if (success) {
        if (reloadButton.classList.contains('hidden'))
          setTimeout(() => reloadButton.classList.remove('hidden'), 100);
        slot.insertAdjacentElement('afterend', getSaveSlotListEntry(slotId));
        slot.remove();
      }
    });
  addTooltip(deleteButton, getMassagedLabel(localizedMessages.save.delete.tooltip, true), true, true);

  buttonsContainer.appendChild(uploadButton);
  buttonsContainer.appendChild(downloadButton);
  buttonsContainer.appendChild(deleteButton);
  content.appendChild(buttonsContainer);

  slot.appendChild(content);

  getSaveSlotData(slotId)
    .then(saveData => {
      contentLabel.innerHTML = saveData == null
        ? getMassagedLabel(localizedMessages.save.slot.emptyLabel, true)
        : saveData.timestamp.toLocaleString(globalConfig.lang === 'en' ? [] : globalConfig.lang, { "dateStyle": "short", "timeStyle": "short" });

      if (saveData != null) {
        contentLabel.classList.add('altText');
        downloadButton.classList.remove('hidden');
        deleteButton.classList.remove('hidden');
      }
    })
    .catch(err => {
      contentLabel.innerHTML = getMassagedLabel(localizedMessages.save.slot.errorLabel, true);
      console.error(err);
    })

  return slot;
}

function uploadSaveFile(file, saveSlot) {
  return new Promise(resolve => {
    if (!file || !saveSlot)
      return resolve(false);

    if (!/\.lsd$/i.test(file.name)) {
      alert(localizedMessages.io.upload.invalidSaveFile);
      document.getElementById('uploadButton').click();
      return;
    }

    const request = indexedDB.open(`/easyrpg/${ynoGameId}/Save`);

    request.onsuccess = function (_e) {

      const reader = new FileReader();
      let readerResult;

      reader.onload = file => {
        readerResult = file.currentTarget.result;
        const saveFile = { timestamp: new Date(), mode: 33206, contents: new Uint8Array(readerResult) };
    
        const db = request.result; 
        const transaction = db.transaction(['FILE_DATA'], 'readwrite');
        const objectStorePutRequest = transaction.objectStore('FILE_DATA').put(saveFile, `/easyrpg/${ynoGameId}/Save/Save${saveSlot}.lsd`);

        objectStorePutRequest.onsuccess = () => resolve(true);
        objectStorePutRequest.onerror = () => resolve(false);
      };
      reader.onerror = () => resolve(false);

      reader.readAsArrayBuffer(file);
    };
    request.onerror = () => resolve(false);
  });
}

function downloadSaveFile(saveSlot) {
  return new Promise(resolve => {
    if (!saveSlot)
        return resolve(false);

    const request = indexedDB.open(`/easyrpg/${ynoGameId}/Save`);

    request.onsuccess = function (_e) {
      const db = request.result; 
      const transaction = db.transaction(['FILE_DATA'], 'readwrite');
      const objectStore = transaction.objectStore('FILE_DATA');
      const objectStoreRequest = objectStore.get(`/easyrpg/${ynoGameId}/Save/Save${saveSlot}.lsd`);

      objectStoreRequest.onsuccess = function (_e) {
        const record = objectStoreRequest.result;

        if (!record) {
          alert(localizedMessages.io.download.emptySlot);
          resolve(false);
        }

        const blob = new Blob([record.contents], {type: 'text/json'});
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `Save${saveSlot}.lsd`;
        link.click();
        link.remove();
        resolve(true);
      };
      objectStoreRequest.onerror = () => resolve(false);
    };
    request.onerror = () => resolve(false);
  });
 
}

function deleteSaveFile(saveSlot) {
  return new Promise(resolve => {
    if (!saveSlot)
      return resolve(false);

    showConfirmModal(localizedMessages.save.delete.confirmDelete.replace('{SLOT_ID}', parseInt(saveSlot)), () => {
      const request = indexedDB.open(`/easyrpg/${ynoGameId}/Save`);

      request.onsuccess = function (_e) {
        const db = request.result; 
        const transaction = db.transaction(['FILE_DATA'], 'readwrite');
        const objectStoreDeleteRequest = transaction.objectStore('FILE_DATA').delete(`/easyrpg/${ynoGameId}/Save/Save${saveSlot}.lsd`);

        objectStoreDeleteRequest.onsuccess = () => resolve(true);
        objectStoreDeleteRequest.onerror = () => resolve(false);
      };
      request.onerror = () => resolve(false);
    }, () => resolve(false));
  });
}

function getSaveSlotData(saveSlotId) {
  return new Promise(resolve => {
    if (!saveSlotId)
      resolve(null);

    const slotId = saveSlotId < 10 ? `0${saveSlotId}` : saveSlotId.toString();
    const request = indexedDB.open(`/easyrpg/${ynoGameId}/Save`);

    request.onupgradeneeded = e => e.target.result.createObjectStore('FILE_DATA');
    request.onsuccess = function (_e) {
      const db = request.result; 
      const transaction = db.transaction(['FILE_DATA'], 'readwrite');
      const objectStore = transaction.objectStore('FILE_DATA');
      const objectStoreRequest = objectStore.get(`/easyrpg/${ynoGameId}/Save/Save${slotId}.lsd`);

      objectStoreRequest.onsuccess = () => resolve(objectStoreRequest.result);
      objectStoreRequest.onerror = () => resolve(null);
    };
  });
}

function formatSaveSlotId(saveSlotId) {
  if (saveSlotId < 1)
    saveSlotId = 1;
  else if (saveSlotId > 15)
    saveSlotId = 15;
  return saveSlotId < 10 ? `0${saveSlotId}` : saveSlotId.toString();
}

function setSaveSyncEnabled(enabled, isInit) {
  const saveSyncButton = document.getElementById('saveSyncButton');
  const toggle = function () {
    saveSyncButton.classList.toggle('toggled', enabled);
    document.getElementById('saveSyncSlotIdRow').classList.toggle('hidden', !enabled);
    if (enabled)
      document.getElementById('saveSyncSlotId').value = 0;
    if (!isInit) {
      saveSyncConfig.enabled = enabled;
      updateConfig(saveSyncConfig, false, 'saveSyncConfig');
    }
  };
  if (!isInit && !saveSyncButton.classList.contains('toggled')) {
    showConfirmModal(localizedMessages.saveSync.confirmEnable, () => {
      apiFetch('savesync?command=timestamp')
        .then(response => {
          if (!response.ok)
            throw new Error('Failed to retrieve timestamp for save sync data');
          return response.text();
        })
        .then(timestamp => {
          if (!timestamp)
            toggle();
          else
            showConfirmModal(localizedMessages.saveSync.confirmEnableWithData, toggle);
        })
        .catch(err => console.error(err));
    });
  } else
    toggle();
}

// EXTERNAL
function onSaveSlotUpdated(slotId) {
  if (loginToken && saveSyncConfig.enabled && slotId == saveSyncConfig.slotId)
    getAndUploadSaveSyncData();
}

function hasSaveDataForSync() {
  return new Promise(resolve => {
    if (!saveSyncConfig.slotId)
      resolve(false);
    const request = indexedDB.open(`/easyrpg/${ynoGameId}/Save`);

    request.onsuccess = function (_e) {
      const db = request.result; 
      const transaction = db.transaction(['FILE_DATA'], 'readwrite');
      const objectStore = transaction.objectStore('FILE_DATA');
      const objectStoreRequest = objectStore.get(`/easyrpg/${ynoGameId}/Save/Save${saveSyncConfig.slotId}.lsd`);

      objectStoreRequest.onsuccess = () => resolve(true);
      objectStoreRequest.onerror = () => resolve(false);
    };
  });
}

function getSaveDataForSync() {
  return getSaveSlotData(saveSyncConfig.slotId);
}

function uploadSaveSyncData(saveData) {
  return new Promise(resolve => {
    if (!loginToken || !saveSyncConfig.enabled)
      resolve(false);
    showSaveSyncToastMessage('saveUploading', 'saveUpload', saveSyncConfig.slotId);
    apiPost('savesync?command=push', saveData.contents)
      .then(_ => {
        showSaveSyncToastMessage('saveUploaded', 'save', saveSyncConfig.slotId);
        resolve(true);
      })
      .catch(_err => resolve(false));
  });
}

function getAndUploadSaveSyncData() {
  return new Promise(resolve => {
    if (!saveSyncConfig.slotId)
      resolve(false);

    getSaveDataForSync().then(saveData => uploadSaveSyncData(saveData).then(success => resolve(success)));
  });
}

function trySyncSave() {
  return new Promise(resolve => {
    apiFetch('savesync?command=timestamp')
      .then(response => {
        if (!response.ok)
          throw new Error('Failed to retrieve timestamp for save sync data');
        return response.text();
      })
      .then(timestamp => {
        getSaveDataForSync().then(saveData => {
          if (timestamp && (timestamp = new Date(timestamp)) && (!saveData || saveData.timestamp < timestamp)) {
            apiFetch('savesync?command=get').then(response => {
              if (!response.ok)
                throw new Error('Failed to get save sync data');
              return response.arrayBuffer();
            })
            .then(saveSyncData => {
              if (saveSyncData) {
                saveSyncData = new Uint8Array(saveSyncData);

                const request = indexedDB.open(`/easyrpg/${ynoGameId}/Save`);

                request.onsuccess = function (_e) {
                  const slotId = saveSyncConfig.slotId < 10 ? `0${saveSyncConfig.slotId}` : saveSyncConfig.slotId.toString();

                  const db = request.result; 
                  const transaction = db.transaction(['FILE_DATA'], 'readwrite');
                  const objectStorePutRequest = transaction.objectStore('FILE_DATA').put({ timestamp: timestamp, mode: 33206, contents: new Uint8Array(saveSyncData) }, `/easyrpg/${ynoGameId}/Save/Save${slotId}.lsd`);

                  objectStorePutRequest.onsuccess = _e => {
                    showSaveSyncToastMessage('saveDownloaded', 'save', saveSyncConfig.slotId);
                    resolve(true);
                  };
                  objectStorePutRequest.onerror = _err => resolve(false);
                };
                request.onerror = _err => resolve(false);
              } else
                resolve(false);
            })
            .catch(err => {
              console.error(err);
              resolve(false);
            })
          } else {
            showSaveSyncToastMessage('saveUpToDate', 'save', saveSyncConfig.slotId);
            resolve(false);
          }
        });
      })
      .catch(err => {
        console.error(err);
        resolve(false);
      });
    })
}

function clearSaveSyncData() {
  return new Promise(resolve => {
    if (!loginToken)
      resolve(false);
    apiFetch(`savesync?command=clear`)
      .then(_ => {
        showSaveSyncToastMessage('saveCleared', 'save');
        resolve(true);
      })
      .catch(_err => resolve(false));
  });
}

let saveDataToastQueue = [];
let saveDataToastTimer = null;

function showSaveSyncToastMessage(key, icon, slotId) {
  if (!notificationConfig.saveSync.all || !notificationConfig.saveSync[key])
    return;
  if (typeof localizedMessages !== 'undefined' && localizedMessages) {
    let message = getMassagedLabel(localizedMessages.toast.saveSync[key], true);
    if (slotId !== undefined)
      message = message.replace('{SLOT}', slotId);
    showToastMessage(message, icon);
  } else {
    if (!saveDataToastTimer) {
      saveDataToastTimer = setInterval(() => {
        if (typeof localizedMessages !== 'undefined' && localizedMessages) {
          for (let toast of saveDataToastQueue)
            showSaveSyncToastMessage(toast.key, toast.icon, toast.slotId);
          clearInterval(saveDataToastTimer);
          saveDataToastTimer = null;
        }
      }, 100);
    }
    saveDataToastQueue.push({ key: key, icon: icon, slotId: slotId });
  }
}