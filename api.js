// Ganti URL di bawah ini dengan URL Web App /exec dari Google Apps Script Anda
var GAS_API_URL = "https://script.google.com/macros/s/AKfycbyjpa3M38gw53jiMJNUslPkBJz3lt2eGCyCMDn83gOavl1T6zq380jJRA3Lg-Y_XY4Q-w/exec"; 

function callGAS(actionName, payloadData) {
  return fetch(GAS_API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: actionName,
      payload: payloadData
    })
  })
  .then(function(response) {
    return response.json();
  })
  .catch(function(error) {
    console.error("Fetch Error pada " + actionName + ":", error);
    return { success: false, message: 'Koneksi ke server gagal: ' + error.toString() };
  });
}