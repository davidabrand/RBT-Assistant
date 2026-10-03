chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.warn("Could not enable side-panel action behavior:", err);
  }
});


function bgSendTabMessage(tabId,message) {
  return new Promise((resolve,reject)=>{
    chrome.tabs.sendMessage(tabId,message,response=>{
      if(chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function bgGetTab(tabId) {
  return new Promise((resolve,reject)=>{
    chrome.tabs.get(tabId,tab=>{
      if(chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(tab);
      }
    });
  });
}



function isOfficePuzzleUrl(url) {
  return /^https:\/\/(?:[^/]+\.)?officepuzzle\.com\//i.test(String(url||""));
}

async function ensureRbtContentScript(tabId) {
  if(!Number.isInteger(tabId)) {
    return {ok:false,error:"Missing tab id."};
  }

  let tab;
  try {
    tab=await bgGetTab(tabId);
  } catch(err) {
    return {ok:false,error:String(err?.message || err)};
  }

  if(!isOfficePuzzleUrl(tab?.url)) {
    return {ok:false,error:"The active tab is not Office Puzzle."};
  }

  // Never inject a duplicate content script.
  try {
    const existing=await bgSendTabMessage(tabId,{type:"GET_CONTEXT"});
    if(existing?.ok) {
      return {ok:true,alreadyConnected:true};
    }
  } catch(_) {
    // No receiver yet: this usually means Office Puzzle was already open
    // before the extension was loaded/reloaded.
  }

  try {
    await chrome.scripting.executeScript({
      target:{tabId},
      files:["scripts/content.js"]
    });
  } catch(err) {
    return {ok:false,error:String(err?.message || err)};
  }

  await new Promise(resolve=>setTimeout(resolve,120));

  try {
    const connected=await bgSendTabMessage(tabId,{type:"GET_CONTEXT"});
    if(connected?.ok) {
      return {ok:true,injected:true};
    }
    return {ok:false,error:"Office Puzzle connected but context was unavailable."};
  } catch(err) {
    return {ok:false,error:String(err?.message || err)};
  }
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type==="ENSURE_RBT_CONTENT_SCRIPT") {
    ensureRbtContentScript(Number(msg.tabId))
      .then(sendResponse)
      .catch(err=>sendResponse({
        ok:false,
        error:String(err?.message || err)
      }));
    return true;
  }
  if(msg?.type==="CAPTURE_RBT_TAB_VIEW") {
    (async()=>{
      const tabId=Number(msg.tabId);
      const tab=await bgGetTab(tabId);

      if(!tab?.active || !isOfficePuzzleUrl(tab?.url)) {
        return {ok:false,error:"Office Puzzle tab is not the visible tab."};
      }

      const dataUrl=await chrome.tabs.captureVisibleTab(
        tab.windowId,
        {format:"jpeg",quality:72}
      );

      return {ok:true,dataUrl};
    })()
      .then(sendResponse)
      .catch(err=>sendResponse({
        ok:false,
        error:String(err?.message || err)
      }));
    return true;
  }
});
