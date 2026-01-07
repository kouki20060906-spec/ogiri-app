// ==============================
// Firebase 初期化（全ページ共通）
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyAgC54qn-Ishg-9yQ5EXH-VrTA6FkDGCVw",
  authDomain: "ogiri-app-d15b9.firebaseapp.com",
  databaseURL: "https://ogiri-app-d15b9-default-rtdb.firebaseio.com",
  projectId: "ogiri-app-d15b9",
  storageBucket: "ogiri-app-d15b9.appspot.com",
  messagingSenderId: "956965855308",
  appId: "1:956965855308:web:db327294abce2487fc54e9"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ==============================
// 共通：4桁のルーム番号生成
// ==============================
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000);
}

// ==============================
// ページ読み込み後
// ==============================
document.addEventListener("DOMContentLoaded", () => {

  const path = window.location.pathname;

 // ==============================
// index.html（ルーム作成）
// ==============================
if (
  path.endsWith("/") ||
  path.endsWith("/index.html") ||
  path.endsWith("ogiri-app/") ||
  path.endsWith("ogiri-app")
) {

    const createRoomBtn = document.getElementById("createRoomBtn");
    const goToAnswerBtn = document.getElementById("goToAnswerBtn");
    const roomCodeDisplay = document.getElementById("roomCodeDisplay");

    let createdRoomCode = null;

    createRoomBtn.addEventListener("click", () => {
      const roomCode = generateRoomCode();
      createdRoomCode = roomCode;

      db.ref(`rooms/${roomCode}`).set({ state: "waiting" });

      roomCodeDisplay.textContent = "ルーム番号：" + roomCode;
      goToAnswerBtn.style.display = "inline-block";
    });

    goToAnswerBtn.addEventListener("click", () => {
      if (!createdRoomCode) {
        alert("先にルームを作成してください");
        return;
      }
      window.location.href = `answer.html?room=${createdRoomCode}`;
    });
  }

  // ==============================
  // join.html（参加者登録）
  // ==============================
  if (path.endsWith("join.html")) {

    const joinBtn = document.getElementById("joinBtn");

    joinBtn.addEventListener("click", () => {
      const roomCode = document.getElementById("roomCodeInput").value.trim();
      const name = document.getElementById("nameInput").value.trim();

      if (!roomCode || !name) {
        alert("ルーム番号と名前を入力してください");
        return;
      }

      const userId = "user_" + Math.random().toString(36).substr(2, 9);
      const userRef = db.ref(`rooms/${roomCode}/users/${userId}`);

      userRef.set({
        name: name,
        online: true
      });

      userRef.child("online").onDisconnect().set(false);

      window.location.href = `vote.html?room=${roomCode}&user=${userId}`;
    });
  }

  // ==============================
  // answer.html（主催者：お題＋回答）
  // ==============================
  if (path.endsWith("answer.html")) {

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");
    if (!roomCode) {
      alert("room パラメータがありません");
      return;
    }

    const themeInput = document.getElementById("themeInput");
    const postThemeBtn = document.getElementById("postThemeBtn");
    const answerInput = document.getElementById("answerInput");
    const startVoteBtn = document.getElementById("startVoteBtn");
    const goToResultBtn = document.getElementById("goToResultBtn");

    // ★ 参加者数をリアルタイム更新
    db.ref(`rooms/${roomCode}/users`).on("value", snap => {
      const users = snap.val() || {};
      const activeCount = Object.values(users).filter(u => u.online).length;
      document.getElementById("activeCount").textContent = activeCount;
    });

    // お題投稿
    postThemeBtn.addEventListener("click", () => {
      const themeText = themeInput.value.trim();
      if (!themeText) {
        alert("お題を入力してください");
        return;
      }

      postThemeBtn.classList.add("button-animate");
      setTimeout(() => postThemeBtn.classList.remove("button-animate"), 250);

      db.ref(`rooms/${roomCode}`).update({
        theme: themeText
      });
    });

    // 回答投稿 → 投票開始
    startVoteBtn.addEventListener("click", () => {
      const answer = answerInput.value.trim();
      if (!answer) {
        alert("回答を入力してください");
        return;
      }

      startVoteBtn.classList.add("button-animate");
      setTimeout(() => startVoteBtn.classList.remove("button-animate"), 250);

      db.ref(`rooms/${roomCode}`).update({
        currentAnswer: answer,
        state: "voting"
      });

      db.ref(`rooms/${roomCode}/votes`).set({});
    });

    // 手動で結果画面へ
    goToResultBtn.addEventListener("click", () => {

      goToResultBtn.classList.add("button-animate");
      setTimeout(() => goToResultBtn.classList.remove("button-animate"), 250);

      db.ref(`rooms/${roomCode}`).update({
        state: "result"
      });
      window.location.href = `result.html?room=${roomCode}`;
    });
  }

  // ==============================
  // vote.html（参加者：投票画面）
  // ==============================
  if (path.endsWith("vote.html")) {

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");
    const userId = params.get("user");

    if (!roomCode || !userId) {
      alert("ルーム情報が取得できませんでした");
      return;
    }

    watchState(roomCode);

    const answerText = document.getElementById("answerText");
    const themeText = document.getElementById("themeText");
    const yesBtn = document.getElementById("yesBtn");
    const noBtn = document.getElementById("noBtn");

    // お題をリアルタイム表示
    db.ref(`rooms/${roomCode}/theme`).on("value", snap => {
      const theme = snap.val();
      themeText.textContent = "お題：" + (theme || "---");
    });

    // 回答をリアルタイム表示
    db.ref(`rooms/${roomCode}/currentAnswer`).on("value", snap => {
      const answer = snap.val();
      answerText.textContent = answer || "回答を待っています…";

      yesBtn.classList.remove("selected");
      yesBtn.classList.add("not-selected");

      noBtn.classList.remove("selected");
      noBtn.classList.add("not-selected");

      document.getElementById("votedIcon").classList.add("hidden");
    });

    yesBtn.addEventListener("click", () => {
      db.ref(`rooms/${roomCode}/votes/${userId}`).set("yes");

      yesBtn.classList.add("selected");
      yesBtn.classList.remove("not-selected");

      noBtn.classList.add("not-selected");
      noBtn.classList.remove("selected");

      document.getElementById("votedIcon").classList.remove("hidden");
    });

    noBtn.addEventListener("click", () => {
      db.ref(`rooms/${roomCode}/votes/${userId}`).set("no");

      noBtn.classList.add("selected");
      noBtn.classList.remove("not-selected");

      yesBtn.classList.add("not-selected");
      yesBtn.classList.remove("selected");

      document.getElementById("votedIcon").classList.remove("hidden");
    });

  }

  // ==============================
  // result.html（主催者：結果画面）
  // ==============================
  if (path.endsWith("result.html")) {

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");
    if (!roomCode) {
      alert("room パラメータがありません");
      return;
    }

    watchState(roomCode);

    const currentAnswer = document.getElementById("currentAnswer");
    const yesCountEl = document.getElementById("yesCount");
    const noCountEl = document.getElementById("noCount");
    const activeCountEl = document.getElementById("activeCount");
    const perfectMessage = document.getElementById("perfectMessage");
    const nextBtn = document.getElementById("nextBtn");

    let activeCount = 0;

    db.ref(`rooms/${roomCode}/users`).on("value", snap => {
      const users = snap.val() || {};
      activeCount = Object.values(users).filter(u => u.online).length;
      activeCountEl.textContent = activeCount;
    });

    db.ref(`rooms/${roomCode}/currentAnswer`).on("value", snap => {
      currentAnswer.textContent = snap.val() || "回答なし";
    });

    db.ref(`rooms/${roomCode}/votes`).on("value", snap => {
      const votes = snap.val() || {};

      const yesCount = Object.values(votes).filter(v => v === "yes").length;
      const noCount = Object.values(votes).filter(v => v === "no").length;

      yesCountEl.textContent = yesCount;
      noCountEl.textContent = noCount;

      if (yesCount === activeCount && activeCount > 0) {
        perfectMessage.classList.remove("hidden");
      } else {
        perfectMessage.classList.add("hidden");
      }
    });

    nextBtn.addEventListener("click", () => {
      db.ref(`rooms/${roomCode}/votes`).set({});
      db.ref(`rooms/${roomCode}`).update({
        currentAnswer: "",
        state: "waiting"
      });
      window.location.href = `answer.html?room=${roomCode}`;
    });

  }

}); // DOMContentLoaded

// ==============================
// state による画面自動遷移
// ==============================
function watchState(roomCode) {
  db.ref(`rooms/${roomCode}/state`).on("value", snap => {
    const state = snap.val();
    const path = window.location.pathname;

    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user");

    if (state === "voting" && userId && !path.endsWith("vote.html")) {
      window.location.href = `vote.html?room=${roomCode}&user=${userId}`;
    }

    if (state === "result" && !userId && !path.endsWith("result.html")) {
      window.location.href = `result.html?room=${roomCode}`;
    }
  });
}