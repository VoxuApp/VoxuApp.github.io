import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs, deleteDoc, doc, setDoc, limit, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const cfg = {
    apiKey: "AIzaSyCiLGL-ChphpxlUZyycTJThyObKQJWsZvk",
    authDomain: "voxu-838aa.firebaseapp.com",
    projectId: "voxu-838aa",
    storageBucket: "voxu-838aa.firebasestorage.app",
    messagingSenderId: "429817709887",
    appId: "1:429817709887:web:268011fbc906643e833f8a"
};

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

let sch = "";
let userRole = "user";
let currentTab = "home";
let mode = true;

onAuthStateChanged(auth, async (user) => {
    const authEl = document.getElementById('auth');
    const mainEl = document.getElementById('main');
    const sideEl = document.querySelector('.nav');

    if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
            const userData = userSnap.data();
            sch = userData.school;
            userRole = userData.role || "user";
            if (userData.preferredTheme) {
                document.body.classList.remove('light-theme', 'puppy-theme', 'kitty-theme');
                if (userData.preferredTheme !== 'dark') document.body.classList.add(`${userData.preferredTheme}-theme`);
                localStorage.setItem('voxu-theme', userData.preferredTheme);
            }
        }
        authEl.classList.add('fade-out');
        setTimeout(() => {
            authEl.style.display = 'none';
            mainEl.style.display = 'block';
            mainEl.classList.add('show-app');
            sideEl.style.display = 'flex';
            setTimeout(() => { sideEl.style.opacity = '1'; }, 50);
            document.getElementById('sl').innerText = sch;
            window.showTab('home');
            checkCloudLock();
        }, 500);
    } else {
        mainEl.style.display = 'none';
        mainEl.classList.remove('show-app');
        sideEl.style.display = 'none';
        sideEl.style.opacity = '0';
        authEl.style.display = 'flex';
        authEl.classList.remove('fade-out');
    }
});

const savedTheme = localStorage.getItem('voxu-theme');
if (savedTheme) {
    document.body.classList.remove('light-theme', 'puppy-theme', 'kitty-theme');
    if (savedTheme !== 'dark') document.body.classList.add(`${savedTheme}-theme`);
}

window.showTab = (tab) => {
    currentTab = tab;
    document.getElementById('view-title').innerText = tab.charAt(0).toUpperCase() + tab.slice(1);

    const navHome = document.getElementById('nav-home');
    const navUpdates = document.getElementById('nav-updates');
    const navSettings = document.getElementById('nav-settings');

    if (navHome) navHome.classList.toggle('active', tab === 'home');
    if (navUpdates) navUpdates.classList.toggle('active', tab === 'updates');
    if (navSettings) navSettings.classList.toggle('active', tab === 'settings');

    document.getElementById('home-post').style.display = (tab === 'home') ? 'block' : 'none';

    const adminPanel = document.getElementById('admin-update-panel');
    if (adminPanel) {
        adminPanel.style.display = (tab === 'updates' && (userRole === 'admin' || userRole === 'mod')) ? 'block' : 'none';
    }

    document.getElementById('posts').style.display = (tab === 'settings') ? 'none' : 'block';
    document.getElementById('settings-view').style.display = (tab === 'settings') ? 'block' : 'none';

    if (tab !== 'settings') loadFeed();
};

window.sendPost = async (col) => {
    const input = document.getElementById(col === 'updates' ? 'upd-msg' : 'msg');
    if (!input.value.trim()) return;
    try {
        await addDoc(collection(db, col), {
            content: input.value,
            author: auth.currentUser.displayName,
            school: sch,
            role: userRole,
            createdAt: serverTimestamp()
        });
        input.value = "";
    } catch (e) { console.error(e); }
};

window.delPost = async (postId) => {
    if ((userRole === 'admin' || userRole === 'mod') && confirm("Delete this post?")) {
        await deleteDoc(doc(db, currentTab === 'updates' ? 'updates' : 'posts', postId));
    }
};

window.setTheme = async (theme) => {
    document.body.classList.remove('light-theme', 'puppy-theme', 'kitty-theme');
    if (theme !== 'dark') document.body.classList.add(`${theme}-theme`);
    if (auth.currentUser) {
        try { await updateDoc(doc(db, "users", auth.currentUser.uid), { preferredTheme: theme }); }
        catch (e) { console.error(e); }
    }
    localStorage.setItem('voxu-theme', theme);
};

document.getElementById('logout-btn').onclick = () => signOut(auth);

const togBtn = document.getElementById('tog');
if (togBtn) {
    togBtn.onclick = () => {
        mode = !mode;
        document.getElementById('title').innerText = mode ? "Log in to Voxu" : "Join Voxu";
        document.getElementById('go').innerText = mode ? "Enter" : "Create Account";
    };
}

document.getElementById('go').onclick = async () => {
    const u = document.getElementById('u').value.trim();
    const p = document.getElementById('p').value;
    const s = document.getElementById('s').value;
    const email = `${u.toLowerCase()}@voxu.edu`;
    try {
        if (mode) {
            await signInWithEmailAndPassword(auth, email, p);
        } else {
            const r = await createUserWithEmailAndPassword(auth, email, p);
            await updateProfile(r.user, { displayName: u });
            await setDoc(doc(db, "users", r.user.uid), { uid: r.user.uid, school: s, role: "user", preferredTheme: "dark" });
        }
    } catch (e) { alert(e.message); }
};

function loadFeed() {
    const col = currentTab === 'updates' ? 'updates' : 'posts';
    const q = query(collection(db, col), where("school", "==", sch), orderBy("createdAt", "desc"));
    onSnapshot(q, (s) => {
        const container = document.getElementById('posts');
        container.innerHTML = "";
        s.forEach(d => {
            const data = d.data();
            const tag = data.role === 'admin' ? '<span class="tag tag-admin">ADMIN</span>' : '';
            const del = (userRole === 'admin' || userRole === 'mod') ? `<button class="del-btn" onclick="delPost('${d.id}')">×</button>` : '';
            const el = document.createElement('div');
            el.className = 'post animate';
            el.innerHTML = `<b>@${data.author}</b> ${tag}${del}<p>${data.content}</p>`;
            container.appendChild(el);
        });
    });
}

async function checkCloudLock() {
    const lockEl = document.getElementById('school-lock');
    if (!lockEl) return;
    try {
        await getDocs(query(collection(db, "posts"), limit(1)));
        lockEl.style.display = 'none';
    } catch (e) {
        if (e.code === 'permission-denied') lockEl.style.display = 'flex';
    }
}