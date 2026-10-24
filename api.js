
/* =====================================================
   PRESENSI PJLP
   API CLIENT - GOOGLE APPS SCRIPT
   Lokasi: /api.js
===================================================== */

// URL Web App Google Apps Script
const GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbyjpa3M38gw53jiMJNUslPkBJz3lt2eGCyCMDn83gOavl1T6zq380jJRA3Lg-Y_XY4Q-w/exec";


/* =====================================================
   MENGELOLA DATA PENGGUNA DAN TOKEN SESI
===================================================== */

/**
 * Mengambil data pengguna yang tersimpan di browser.
 */
function getCurrentSessionUser() {
  try {
    return JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );
  } catch (error) {
    console.error("Data sesi tidak valid:", error);
    return null;
  }
}

/**
 * Mengambil token sesi pengguna.
 */
function getSessionToken() {
  const user = getCurrentSessionUser();

  return user && typeof user.token === "string"
    ? user.token
    : "";
}

/**
 * Menyimpan data pengguna setelah login.
 * Token harus berasal dari respons server.
 */
function saveCurrentSessionUser(userData, token) {
  if (!userData || typeof userData !== "object") {
    throw new Error("Data pengguna tidak valid.");
  }

  if (!token || typeof token !== "string") {
    throw new Error("Token sesi tidak tersedia.");
  }

  const sessionUser = {
    ...userData,
    token: token
  };

  localStorage.setItem(
    "currentUser",
    JSON.stringify(sessionUser)
  );

  return sessionUser;
}

/**
 * Menghapus sesi lokal browser.
 */
function clearLocalSession() {
  localStorage.removeItem("currentUser");
  sessionStorage.removeItem("currentUser");
}


/* =====================================================
   FUNGSI UTAMA PEMANGGILAN API
===================================================== */

/**
 * Mengirim permintaan ke Google Apps Script.
 *
 * Contoh:
 * callGAS("processLogin", {
 *   nip: "123456",
 *   password: "password",
 *   deviceImei: ""
 * });
 */
async function callGAS(actionName, payloadData = {}) {
  if (
    !actionName ||
    typeof actionName !== "string"
  ) {
    return {
      success: false,
      message: "Nama action API tidak valid."
    };
  }

  const isLogin =
    actionName === "login" ||
    actionName === "processLogin";

  const isPublicAction =
    isLogin ||
    actionName === "getScriptUrl";

  const requestBody = {
    action: actionName,
    payload: payloadData
  };

  // Semua action selain login dan getScriptUrl
  // harus mengirim token sesi.
  if (!isPublicAction) {
    const token = getSessionToken();

    if (!token) {
      return {
        success: false,
        message:
          "Sesi tidak ditemukan. Silakan login kembali.",
        sessionExpired: true
      };
    }

    requestBody.token = token;
  }

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "Respons API bukan JSON:",
        actionName,
        responseText.slice(0, 300)
      );

      return {
        success: false,
        message:
          "Respons server tidak dapat dibaca. Periksa URL Web App dan konfigurasi Code.gs."
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message:
          result.message ||
          "Permintaan ke server gagal."
      };
    }

    // Jangan menghapus sesi otomatis untuk setiap kegagalan.
    // Hanya respons autentikasi yang secara eksplisit
    // menyatakan sesi tidak valid yang ditangani di sini.
    if (
      !result.success &&
      (
        result.sessionExpired === true ||
        result.code === "INVALID_SESSION" ||
        result.code === "SESSION_EXPIRED"
      )
    ) {
      clearLocalSession();
    }

    return result;

  } catch (error) {
    console.error(
      "Kesalahan API:",
      actionName,
      error
    );

    return {
      success: false,
      message:
        "Tidak dapat terhubung ke server. Periksa koneksi internet dan URL API."
    };
  }
}


/* =====================================================
   FUNGSI LOGOUT
===================================================== */

/**
 * Meminta server mengakhiri sesi,
 * kemudian membersihkan sesi lokal.
 */
async function logoutUser() {
  let result = {
    success: false,
    message: "Sesi lokal dibersihkan."
  };

  const token = getSessionToken();

  if (token) {
    try {
      result = await callGAS("logout", {});
    } catch (error) {
      console.error(
        "Gagal mengakhiri sesi server:",
        error
      );
    }
  }

  clearLocalSession();

  return result;
}


/* =====================================================
   HELPER PEMERIKSAAN SESI
===================================================== */

/**
 * Memastikan pengguna mempunyai sesi lokal.
 * Ini hanya pemeriksaan awal di browser.
 * Validasi keamanan tetap wajib dilakukan server.
 */
function hasLocalSession() {
  const user = getCurrentSessionUser();

  return Boolean(
    user &&
    user.token &&
    user.nip
  );
}

/**
 * Memastikan role sesuai.
 * Ini bukan pengganti pemeriksaan role di Code.gs.
 */
function hasRole(expectedRole) {
  const user = getCurrentSessionUser();

  if (!user || !user.role) {
    return false;
  }

  return (
    user.role.toString().trim().toUpperCase() ===
    expectedRole.toString().trim().toUpperCase()
  );
}
