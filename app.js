const TAG = "VipUsersApp";
const UNDO_TIMEOUT_MS = 5000;
const KEY_PATTERN = /^[A-Za-z0-9-]+$/;
const DATE_FORMAT = "MM/dd/yyyy";

class User {
    constructor(id, name, key, startDate, months, valid, expiration) {
        this.id = id;
        this.name = name;
        this.key = key;
        this.startDate = startDate;
        this.months = months || "0";
        this.valid = valid || "0";
        this.expiration = expiration || "N/A";
    }

    isActive() {
        if (this.expiration === "N/A") return false;
        try {
            const expirationDate = dateFns.parse(this.expiration, DATE_FORMAT, new Date());
            return dateFns.isAfter(expirationDate, new Date());
        } catch (e) {
            console.error(`${TAG}: Invalid expiration date for user ${this.id}`, e);
            return false;
        }
    }
}

let allUsers = [];
let filteredUsers = [];
let deletedUsers = [];
let showExpiredUsers = false;
let apiUrl = localStorage.getItem("SHEET_API_URL") || "";
let apiKey = localStorage.getItem("SHEET_API_KEY") || "";

// DOM Elements
const searchInput = document.getElementById("searchInput");
const userCount = document.getElementById("userCount");
const usersTable = document.getElementById("usersTable");
const refreshBtn = document.getElementById("refreshBtn");
const addUserBtn = document.getElementById("addUserBtn");
const syncBtn = document.getElementById("syncBtn");
const expiredToggleBtn = document.getElementById("expiredToggleBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const configBtn = document.getElementById("configBtn");
const userModal = document.getElementById("userModal");
const userModalTitle = document.getElementById("userModalTitle");
const userIdInput = document.getElementById("userIdInput");
const nameInput = document.getElementById("nameInput");
const keyInput = document.getElementById("keyInput");
const startDateInput = document.getElementById("startDateInput");
const monthInput = document.getElementById("monthInput");
const validInput = document.getElementById("validInput");
const expirationInput = document.getElementById("expirationInput");
const nameError = document.getElementById("nameError");
const keyError = document.getElementById("keyError");
const startDateError = document.getElementById("startDateError");
const cancelUserBtn = document.getElementById("cancelUserBtn");
const saveUserBtn = document.getElementById("saveUserBtn");
const configModal = document.getElementById("configModal");
const apiUrlInput = document.getElementById("apiUrlInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const apiUrlError = document.getElementById("apiUrlError");
const apiKeyError = document.getElementById("apiKeyError");
const cancelConfigBtn = document.getElementById("cancelConfigBtn");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const syncModal = document.getElementById("syncModal");
const downloadSyncBtn = document.getElementById("downloadSyncBtn");
const uploadSyncBtn = document.getElementById("uploadSyncBtn");
const fullSyncBtn = document.getElementById("fullSyncBtn");
const cancelSyncBtn = document.getElementById("cancelSyncBtn");
const progressModal = document.getElementById("progressModal");
const progressMessage = document.getElementById("progressMessage");
const toast = document.getElementById("toast");

let currentUser = null;
let currentPosition = -1;

// Initialize
loadUsers();
autoDeleteExpiredUsers();

// Event Listeners
refreshBtn.addEventListener("click", refreshData);
addUserBtn.addEventListener("click", () => showUserModal(null, -1));
syncBtn.addEventListener("click", showSyncModal);
expiredToggleBtn.addEventListener("click", showExpiredUsersToggle);
clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    filterUsers("");
});
configBtn.addEventListener("click", showConfigModal);
cancelUserBtn.addEventListener("click", closeUserModal);
saveUserBtn.addEventListener("click", saveUser);
cancelConfigBtn.addEventListener("click", closeConfigModal);
saveConfigBtn.addEventListener("click", saveConfig);
downloadSyncBtn.addEventListener("click", refreshData);
uploadSyncBtn.addEventListener("click", uploadData);
fullSyncBtn.addEventListener("click", fullSync);
cancelSyncBtn.addEventListener("click", closeSyncModal);
searchInput.addEventListener("input", () => {
    clearTimeout(searchInput.dataset.timeout);
    searchInput.dataset.timeout = setTimeout(() => filterUsers(searchInput.value), 300);
});
validInput.addEventListener("input", () => {
    try {
        const validityDays = parseInt(validInput.value) || 0;
        if (validityDays >= 0 && startDateInput.value) {
            const startDate = dateFns.parse(startDateInput.value, "yyyy-MM-dd", new Date());
            const expiration = dateFns.format(dateFns.addDays(startDate, validityDays - 1), DATE_FORMAT);
            expirationInput.value = expiration;
        } else {
            expirationInput.value = "N/A";
        }
    } catch (e) {
        expirationInput.value = "N/A";
    }
});

function loadUsers() {
    const data = localStorage.getItem("vip_users_data") || "[]";
    try {
        allUsers = JSON.parse(data).map(u => new User(
            u.Users || "N/A",
            u.Name || "N/A",
            u.Key || "N/A",
            convertStartDate(u.Start || "N/A"),
            u.Month || "0",
            u.Valid || "0",
            u.Expiration || "N/A"
        ));
        filterUsers(searchInput.value);
    } catch (e) {
        console.error(`${TAG}: Error parsing users JSON`, e);
        showToast("Failed to load users", "error");
    }
}

function convertStartDate(startStr) {
    if (startStr === "N/A" || /^\d+$/.test(startStr)) {
        try {
            const days = parseInt(startStr) || 0;
            const baseDate = dateFns.parse("01/01/1900", DATE_FORMAT, new Date());
            return dateFns.format(dateFns.addDays(baseDate, days - 1), DATE_FORMAT);
        } catch (e) {
            console.error(`${TAG}: Invalid start date format: ${startStr}`, e);
        }
    }
    return startStr;
}

function filterUsers(query) {
    filteredUsers = allUsers.filter(user => 
        (showExpiredUsers || user.isActive()) &&
        (!query || 
         user.id.toLowerCase().includes(query.toLowerCase()) ||
         user.name.toLowerCase().includes(query.toLowerCase()))
    );
    renderUsers();
    updateUserCount();
}

function updateUserCount() {
    const activeCount = filteredUsers.filter(u => u.isActive()).length;
    userCount.textContent = `${filteredUsers.length} user${filteredUsers.length !== 1 ? "s" : ""} (${activeCount} active)${filteredUsers.length !== allUsers.length ? ` of ${allUsers.length} total` : ""}`;
}

function renderUsers() {
    usersTable.innerHTML = "";
    filteredUsers.forEach((user, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="p-2 border">${user.id}</td>
            <td class="p-2 border">${user.name}</td>
            <td class="p-2 border">${user.key}</td>
            <td class="p-2 border">${user.startDate}</td>
            <td class="p-2 border">${user.months}</td>
            <td class="p-2 border">${user.valid}</td>
            <td class="p-2 border">${user.ex extinction}</td>
            <td class="p-2 border ${user.isActive() ? "text-green-500" : "text-red-500"}">
                ${user.isActive() ? "✓ Active" : "✗ Expired"}
            </td>
            <td class="p-2 border">
                <button onclick="showUserModal(allUsers[${allUsers.indexOf(user)}], ${index})" class="p-1 bg-blue-500 text-white rounded">Edit</button>
                <button onclick="deleteUser(${index})" class="p-1 bg-red-500 text-white rounded ml-2">Delete</button>
            </td>
        `;
        usersTable.appendChild(row);
    });
}

function showUserModal(user, position) {
    currentUser = user;
    currentPosition = position;
    userModalTitle.textContent = user ? "Edit User" : "Add User";
    saveUserBtn.textContent = user ? "Update" : "Save";
    userIdInput.value = user ? user.id : getNextUniqueId();
    nameInput.value = user ? user.name : "";
    keyInput.value = user ? user.key : "";
    startDateInput.value = user ? dateFns.format(dateFns.parse(user.startDate, DATE_FORMAT, new Date()), "yyyy-MM-dd") : dateFns.format(new Date(), "yyyy-MM-dd");
    monthInput.value = user ? user.months : "0";
    validInput.value = user ? user.valid : "0";
    expirationInput.value = user ? user.expiration : "N/A";
    clearErrors();
    userModal.style.display = "block";
}

function closeUserModal() {
    userModal.style.display = "none";
    clearErrors();
}

function clearErrors() {
    nameError.classList.add("hidden");
    keyError.classList.add("hidden");
    startDateError.classList.add("hidden");
}

function validateUserInput() {
    let valid = true;
    clearErrors();

    if (!nameInput.value.trim()) {
        nameError.textContent = "Name is required";
        nameError.classList.remove("hidden");
        valid = false;
    } else if (nameInput.value.length > 50) {
        nameError.textContent = "Name too long (max 50 chars)";
        nameError.classList.remove("hidden");
        valid = false;
    }

    if (!keyInput.value.trim()) {
        keyError.textContent = "Key is required";
        keyError.classList.remove("hidden");
        valid = false;
    } else if (!KEY_PATTERN.test(keyInput.value)) {
        keyError.textContent = "Invalid key format (alphanumeric and hyphens only)";
        keyError.classList.remove("hidden");
        valid = false;
    } else if (allUsers.some(u => u.key === keyInput.value && (!currentUser || u.id !== currentUser.id))) {
        keyError.textContent = "Key already exists";
        keyError.classList.remove("hidden");
        valid = false;
    }

    if (!startDateInput.value) {
        startDateError.textContent = "Start date is required";
        startDateError.classList.remove("hidden");
        valid = false;
    } else {
        try {
            const startDate = dateFns.parse(startDateInput.value, "yyyy-MM-dd", new Date());
            if (dateFns.isAfter(startDate, new Date())) {
                startDateError.textContent = "Start date cannot be in the future";
                startDateError.classList.remove("hidden");
                valid = false;
            }
        } catch (e) {
            startDateError.textContent = "Invalid date format";
            startDateError.classList.remove("hidden");
            valid = false;
        }
    }

    return valid;
}

function saveUser() {
    if (!validateUserInput()) return;

    const user = new User(
        userIdInput.value,
        nameInput.value.trim(),
        keyInput.value.trim(),
        dateFns.format(dateFns.parse(startDateInput.value, "yyyy-MM-dd", new Date()), DATE_FORMAT),
        monthInput.value || "0",
        validInput.value || "0",
        expirationInput.value
    );

    if (currentUser) {
        allUsers[currentPosition] = user;
    } else {
        allUsers.push(user);
    }

    saveUsers(true).then(() => {
        closeUserModal();
        showToast("User saved successfully", "success");
    }).catch(e => showToast(`Error saving user: ${getErrorMessage(e)}`, "error"));
}

function deleteUser(position) {
    if (!confirm(`Delete user ${filteredUsers[position].name} (${filteredUsers[position].id})?`)) return;
    
    const user = filteredUsers[position];
    deletedUsers.push(user);
    allUsers.splice(allUsers.indexOf(user), 1);
    saveUsers(false).then(() => {
        deleteUserFromSheet(user.id);
        showToast("User deleted", "success", () => {
            allUsers.splice(position, 0, user);
            deletedUsers = deletedUsers.filter(u => u.id !== user.id);
            saveUsers(true);
        });
        setTimeout(() => {
            deletedUsers = deletedUsers.filter(u => u.id !== user.id);
        }, UNDO_TIMEOUT_MS);
    }).catch(e => showToast(`Error deleting user: ${getErrorMessage(e)}`, "error"));
}

function showExpiredUsersToggle() {
    if (confirm(showExpiredUsers ? "Hide expired users?" : "Show expired users?")) {
        showExpiredUsers = !showExpiredUsers;
        expiredToggleBtn.textContent = showExpiredUsers ? "Hide Expired" : "Show Expired";
        filterUsers(searchInput.value);
    } else if (confirm("Delete all expired users? This cannot be undone.")) {
        deleteExpiredUsers();
    }
}

function deleteExpiredUsers() {
    const toDelete = allUsers.filter(u => !u.isActive());
    if (toDelete.length === 0) {
        showToast("No expired users found", "error");
        return;
    }

    deletedUsers.push(...toDelete);
    allUsers = allUsers.filter(u => u.isActive());
    saveUsers(false).then(() => {
        toDelete.forEach(u => deleteUserFromSheet(u.id));
        showToast(`Deleted ${toDelete.length} expired users`, "success", () => {
            allUsers.push(...deletedUsers);
            deletedUsers = [];
            saveUsers(true);
        });
        setTimeout(() => {
            deletedUsers = [];
        }, UNDO_TIMEOUT_MS);
    }).catch(e => showToast(`Error deleting expired users: ${getErrorMessage(e)}`, "error"));
}

function showConfigModal() {
    apiUrlInput.value = apiUrl;
    apiKeyInput.value = apiKey;
    apiUrlError.classList.add("hidden");
    apiKeyError.classList.add("hidden");
    configModal.style.display = "block";
}

function closeConfigModal() {
    configModal.style.display = "none";
}

function saveConfig() {
    if (!apiUrlInput.value.trim()) {
        apiUrlError.textContent = "API URL required";
        apiUrlError.classList.remove("hidden");
        return;
    }
    if (!apiKeyInput.value.trim()) {
        apiKeyError.textContent = "API Key required";
        apiKeyError.classList.remove("hidden");
        return;
    }

    apiUrl = apiUrlInput.value.trim();
    apiKey = apiKeyInput.value.trim();
    localStorage.setItem("SHEET_API_URL", apiUrl);
    localStorage.setItem("SHEET_API_KEY", apiKey);
    closeConfigModal();
    showToast("Configuration saved", "success");
    refreshData();
}

function showSyncModal() {
    syncModal.style.display = "block";
}

function closeSyncModal() {
    syncModal.style.display = "none";
}

function refreshData() {
    showProgress("Refreshing data...");
    fetchVipUsersFromSheet()
        .then(data => {
            localStorage.setItem("vip_users_data", JSON.stringify(data));
            loadUsers();
            showToast("Data refreshed successfully", "success");
        })
        .catch(e => showToast(`Refresh failed: ${getErrorMessage(e)}`, "error"))
        .finally(() => hideProgress());
}

function uploadData() {
    showProgress("Uploading data...");
    syncWithSheetBest(allUsers)
        .then(() => showToast("Upload successful", "success"))
        .catch(e => showToast(`Upload failed: ${getErrorMessage(e)}`, "error"))
        .finally(() => hideProgress());
}

function fullSync() {
    showProgress("Syncing data...");
    fetchVipUsersFromSheet()
        .then(remoteData => {
            const remoteUsers = remoteData.map(u => new User(
                u.Users, u.Name, u.Key, u.Start, u.Month, u.Valid, u.Expiration
            ));
            const mergedUsers = [...remoteUsers];
            const remoteIds = new Set(remoteUsers.map(u => u.id));
            allUsers.forEach(u => {
                if (!remoteIds.has(u.id)) mergedUsers.push(u);
            });
            allUsers = mergedUsers;
            return syncWithSheetBest(allUsers);
        })
        .then(() => {
            saveUsers(false);
            showToast("Full sync completed", "success");
        })
        .catch(e => showToast(`Sync failed: ${getErrorMessage(e)}`, "error"))
        .finally(() => hideProgress());
}

function autoDeleteExpiredUsers() {
    const expiredUsers = allUsers.filter(u => !u.isActive());
    if (expiredUsers.length > 0 && confirm(`Found ${expiredUsers.length} expired users. Delete them?`)) {
        deletedUsers.push(...expiredUsers);
        allUsers = allUsers.filter(u => u.isActive());
        saveUsers(false).then(() => {
            expiredUsers.forEach(u => deleteUserFromSheet(u.id));
            showToast(`Deleted ${expiredUsers.length} expired users`, "success", () => {
                allUsers.push(...deletedUsers);
                deletedUsers = [];
                saveUsers(true);
            });
            setTimeout(() => {
                deletedUsers = [];
            }, UNDO_TIMEOUT_MS);
        }).catch(e => showToast(`Error deleting expired users: ${getErrorMessage(e)}`, "error"));
    }
}

async function saveUsers(uploadToSheet) {
    try {
        localStorage.setItem("vip_users_data", JSON.stringify(allUsers.map(u => ({
            Users: u.id,
            Name: u.name,
            Key: u.key,
            Start: u.startDate,
            Month: u.months,
            Valid: u.valid,
            Expiration: u.expiration
        }))));
        if (uploadToSheet) {
            await syncWithSheetBest(allUsers);
        }
        filterUsers(searchInput.value);
    } catch (e) {
        console.error(`${TAG}: Error saving users`, e);
        throw e;
    }
}

async function fetchVipUsersFromSheet() {
    if (!apiUrl || !apiKey) throw new Error("SheetBest API not configured");
    const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

async function syncWithSheetBest(users) {
    if (!apiUrl || !apiKey) throw new Error("SheetBest API not configured");
    const response = await fetch(`${apiUrl}/bulk`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(users.map(u => ({
            Users: u.id,
            Name: u.name,
            Key: u.key,
            Start: u.startDate,
            Month: u.months,
            Valid: u.valid,
            Expiration: u.expiration
        })))
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

async function deleteUserFromSheet(userId) {
    if (!apiUrl || !apiKey) throw new Error("SheetBest API not configured");
    try {
        const response = await fetch(`${apiUrl}/${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (e) {
        console.error(`${TAG}: Delete failed for user ${userId}`, e);
    }
}

function getNextUniqueId() {
    const maxId = allUsers.reduce((max, u) => {
        const id = parseInt(u.id) || 0;
        return id > max ? id : max;
    }, 0);
    return (maxId + 1).toString();
}

function showToast(message, type, undoCallback) {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    if (undoCallback) {
        const undoBtn = document.createElement("button");
        undoBtn.textContent = "Undo";
        undoBtn.className = "ml-2 underline";
        undoBtn.onclick = () => {
            undoCallback();
            toast.classList.add("hidden");
        };
        toast.appendChild(undoBtn);
    }
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
        toast.innerHTML = "";
    }, UNDO_TIMEOUT_MS);
}

function showProgress(message) {
    progressMessage.textContent = message;
    progressModal.classList.remove("hidden");
}

function hideProgress() {
    progressModal.classList.add("hidden");
}

function getErrorMessage(e) {
    if (e.message.includes("HTTP 401") || e.message.includes("HTTP 403")) {
        return "Authentication failed. Please check API key.";
    } else if (e.message.includes("HTTP 429")) {
        return "Rate limit exceeded. Please try again later.";
    } else if (e.message.includes("HTTP 5")) {
        return "Server error. Please try again later.";
    }
    return e.message || "Unknown error";
}
