// api.js - File Penghubung Frontend ke Google Apps Script (Backend)

const GAS_URL = "https://script.google.com/macros/s/AKfycbyjpa3M38gw53jiMJNUslPkBJz3lt2eGCyCMDn83gOavl1T6zq380jJRA3Lg-Y_XY4Q-w/exec";

/**
 * Fungsi umum untuk mengirim request ke Apps Script
 * @param {string} action Nama aksi (contoh: 'login', 'getRekapData', 'submitPresensi')
 * @param {object} payload Data tambahan yang dikirim
 */
async function callGAS(action, payload = {}) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action: action, ...payload })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error API GAS:", error);
    return { success: false, message: "Gagal terhubung ke server. Periksa koneksi internet Anda." };
  }
}