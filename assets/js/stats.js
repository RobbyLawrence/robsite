// View and like counters backed by Firestore.
//
// Documents live in the "views" and "likes" collections with IDs like
// "views_posts-enclose-horse-index.md" and a single numeric field named after
// the collection. These IDs and the localStorage keys below are the same ones
// the Blowfish theme used, so existing counts and visitors' likes carry over.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  increment,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const { firebase, page } = JSON.parse(document.getElementById("stats-config").textContent);
const app = initializeApp(firebase);
const db = getFirestore(app);
const auth = getAuth(app);

const viewsId = page && `views_${page}`;
const likesId = page && `likes_${page}`;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, on) {
  try {
    on ? localStorage.setItem(key, true) : localStorage.removeItem(key);
  } catch {
    // Storage blocked (e.g. private mode); counts still work, just not deduped.
  }
}

// Keep every count on the page in sync with Firestore.
function watchCounts() {
  document.querySelectorAll(".stat-count[data-id]").forEach((el) => {
    const { collection, id } = el.dataset;
    onSnapshot(
      doc(db, collection, id),
      (snap) => {
        el.textContent = (snap.exists() ? snap.data()[collection] : 0).toLocaleString();
      },
      (e) => console.error(`Failed to read ${collection}/${id}:`, e.message),
    );
  });
}

// Count one view per page per browser.
async function recordView() {
  if (!viewsId || storageGet(viewsId)) return;
  try {
    await setDoc(doc(db, "views", viewsId), { views: increment(1) }, { merge: true });
    storageSet(viewsId, true);
  } catch (e) {
    console.error("Failed to record view:", e.message);
  }
}

function setupLikeButton() {
  const button = document.getElementById("like-button");
  if (!button || !likesId) return;

  let liked = Boolean(storageGet(likesId));
  const render = () => {
    button.setAttribute("aria-pressed", liked);
    button.querySelector(".like-heart").textContent = liked ? "♥" : "♡";
    button.querySelector(".like-label").textContent = liked ? "Liked" : "Like";
  };

  button.addEventListener("click", async () => {
    liked = !liked;
    render();
    button.disabled = true;
    try {
      await setDoc(doc(db, "likes", likesId), { likes: increment(liked ? 1 : -1) }, { merge: true });
      storageSet(likesId, liked);
    } catch (e) {
      console.error("Failed to update like:", e.message);
      liked = !liked;
      render();
    } finally {
      button.disabled = false;
    }
  });

  render();
  button.disabled = false;
}

watchCounts();

// Writes require a signed-in user, so record views and enable likes only after
// anonymous sign-in succeeds.
signInAnonymously(auth)
  .then(() => {
    recordView();
    setupLikeButton();
  })
  .catch((e) => console.error("Firebase anonymous sign-in failed:", e.message));
