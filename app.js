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
  // create.html（ルーム作成）
  // ==============================
  if (path.endsWith("create.html")) {

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

    // 参加者数表示（参考用）
    db.ref(`rooms/${roomCode}/users`).on("value", snap => {
      const users = snap.val() || {};
      const activeCount = Object.values(users).filter(u => u.online).length;
      document.getElementById("activeCount").textContent = activeCount;
    });

    // ★ お題投稿 → 投稿済みにする
    postThemeBtn.addEventListener("click", () => {
      const themeText = themeInput.value.trim();
      if (!themeText) {
        alert("お題を入力してください");
        return;
      }

      db.ref(`rooms/${roomCode}`).update({
        theme: themeText
      });

      postThemeBtn.textContent = "投稿済み";
      postThemeBtn.disabled = true;
    });

    // ★ 回答投稿 → 投稿済みにする
    startVoteBtn.addEventListener("click", () => {
      const answer = answerInput.value.trim();
      if (!answer) {
        alert("回答を入力してください");
        return;
      }

      db.ref(`rooms/${roomCode}`).update({
        currentAnswer: answer,
        state: "voting"
      });

      db.ref(`rooms/${roomCode}/votes`).set({});

      startVoteBtn.textContent = "投稿済み";
      startVoteBtn.disabled = true;
    });

    goToResultBtn.addEventListener("click", () => {
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

    // お題表示
    db.ref(`rooms/${roomCode}/theme`).on("value", snap => {
      const theme = snap.val();
      themeText.textContent = "お題：" + (theme || "---");
    });

    // ★ 新しい回答が来たら投票ボタンをリセット
    db.ref(`rooms/${roomCode}/currentAnswer`).on("value", snap => {
      const answer = snap.val();
      answerText.textContent = answer || "回答を待っています…";

      yesBtn.classList.remove("selected", "not-selected");
      noBtn.classList.remove("selected", "not-selected");
      document.getElementById("votedIcon").classList.add("hidden");
    });

    yesBtn.addEventListener("click", () => {
      db.ref(`rooms/${roomCode}/votes/${userId}`).set("yes");

      yesBtn.classList.add("selected");
      noBtn.classList.add("not-selected");
      document.getElementById("votedIcon").classList.remove("hidden");
    });

    noBtn.addEventListener("click", () => {
      db.ref(`rooms/${roomCode}/votes/${userId}`).set("no");

      noBtn.classList.add("selected");
      yesBtn.classList.add("not-selected");
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

    // 回答表示
    db.ref(`rooms/${roomCode}/currentAnswer`).on("value", snap => {
      currentAnswer.textContent = snap.val() || "回答なし";
    });

    // ★ 投票結果監視 → 全員YESなら演出発動
    db.ref(`rooms/${roomCode}/votes`).on("value", snap => {
      const votes = snap.val() || {};

      const yesCount = Object.values(votes).filter(v => v === "yes").length;
      const noCount = Object.values(votes).filter(v => v === "no").length;

      yesCountEl.textContent = yesCount;
      noCountEl.textContent = noCount;

      // ★ 修正ポイント：参加者数を votes の人数から計算
      const activeCount = Object.keys(votes).length;
      activeCountEl.textContent = activeCount;

      // ★ 全員一致の判定
      if (yesCount === activeCount && activeCount > 0) {
        perfectMessage.classList.remove("hidden");

        triggerIpponEffect();
        startConfetti();
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

// ==============================
// ★ IPPON!! 演出
// ==============================
function triggerIpponEffect() {
  const ippon = document.getElementById("ipponEffect");

  ippon.classList.remove("hidden");
  ippon.style.animation = "none";
  void ippon.offsetWidth;

  ippon.style.animation = "ipponPop 1.5s ease-out forwards";

  setTimeout(() => {
    ippon.classList.add("hidden");
  }, 2000);
}

// ==============================
// ★ 紙吹雪演出（本体）
// ==============================
function startConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  canvas.classList.remove("hidden");

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confetti = [];
  const colors = ["#ff4d4d", "#4dff4d", "#4d4dff", "#ffff4d", "#ff4dff"];

  for (let i = 0; i < 150; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      c: colors[Math.floor(Math.random() * colors.length)],
      s: Math.random() * 3 + 2
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confetti.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.fill();

      p.y += p.s;
      if (p.y > canvas.height) p.y = -10;
    });

    requestAnimationFrame(draw);
  }

  draw();

  setTimeout(() => {
    canvas.classList.add("hidden");
  }, 5000);
}