/* ============================================================
   Firebase 初期化
============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyAgC54qn-Ishg-9yQ5EXH-VrTA6FkDGCVw",
  authDomain: "ogiri-app-d15b9.firebaseapp.com",
  databaseURL: "https://ogiri-app-d15b9-default-rtdb.firebaseio.com",
  projectId: "ogiri-app-d15b9",
  storageBucket: "ogiri-app-d15b9.appspot.com",
  messagingSenderId: "956965855308",
  appId: "1:956965855308:web:db327294abce2487fc54e9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ============================================================
   URL パラメータ
============================================================ */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const roomId = getParam("room");
const userId = getParam("user");

/* ============================================================
   画面判定
============================================================ */
const page = document.body.dataset.page;

/* ============================================================
   create.html
============================================================ */
if (page === "create") {
  const createBtn = document.getElementById("createRoomBtn");
  const roomCodeDisplay = document.getElementById("roomCodeDisplay");
  const goToAnswerBtn = document.getElementById("goToAnswerBtn");

  createBtn.onclick = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();

    db.ref(`rooms/${newRoomId}`).set({
      theme: "",
      answers: {},     // ★ push が動く形式
      currentIndex: 0,
      votes: {},
      users: {}
    });

    roomCodeDisplay.textContent = `ルーム番号：${newRoomId}`;
    goToAnswerBtn.style.display = "block";

    goToAnswerBtn.onclick = () => {
      window.location.href = `answer.html?room=${newRoomId}`;
    };
  };
}

/* ============================================================
   join.html
============================================================ */
if (page === "join") {
  const joinBtn = document.getElementById("joinBtn");

  joinBtn.onclick = () => {
    const roomCode = document.getElementById("roomCodeInput").value;
    const name = document.getElementById("nameInput").value;

    if (!roomCode || !name) return alert("入力してください");

    const userKey = db.ref(`rooms/${roomCode}/users`).push().key;

    db.ref(`rooms/${roomCode}/users/${userKey}`).set({
      name,
      vote: null
    });

    window.location.href = `vote.html?room=${roomCode}&user=${userKey}`;
  };
}

/* ============================================================
   answer.html（主催者）
============================================================ */
if (page === "answer") {

  document.getElementById("roomCodeDisplay").textContent = `ルーム番号：${roomId}`;

  const themeInput = document.getElementById("themeInput");
  const answerInput = document.getElementById("answerInput");

  // お題投稿
  document.getElementById("postThemeBtn").onclick = () => {
    db.ref(`rooms/${roomId}/theme`).set(themeInput.value);
  };

  // 回答投稿
 document.getElementById("startVoteBtn").onclick = () => {
  const answer = answerInput.value;
  if (!answer) return;

  db.ref(`rooms/${roomId}/answers`).push(answer);
  db.ref(`rooms/${roomId}/votes`).set({});

  // 入力欄クリア
  answerInput.value = "";

  // ★ ボタンを「投稿済み」に変更
  const btn = document.getElementById("startVoteBtn");
  btn.textContent = "投稿済み";
  btn.classList.add("btn-disabled");

  };

  // 結果へ
  document.getElementById("goToResultBtn").onclick = () => {
    window.location.href = `result.html?room=${roomId}`;
  };

  // 参加者数
  db.ref(`rooms/${roomId}/users`).on("value", snap => {
    const users = snap.val() || {};
    document.getElementById("activeCount").textContent = Object.keys(users).length;
  });

  // ★ 現在の回答（currentIndex の位置）
  db.ref(`rooms/${roomId}`).on("value", snap => {
    const data = snap.val();
    if (!data) return;

    const answers = Object.values(data.answers || {});
    const index = data.currentIndex || 0;

    document.getElementById("currentAnswerDisplay").textContent =
      answers[index] || "まだありません";
  });
}

/* ============================================================
   vote.html
============================================================ */
if (page === "vote") {
  const yesBtn = document.getElementById("yesBtn");
  const noBtn = document.getElementById("noBtn");
  const votedIcon = document.getElementById("votedIcon");

  db.ref(`rooms/${roomId}`).on("value", snap => {
    const data = snap.val();
    if (!data) return;

    document.getElementById("themeText").textContent = `お題：${data.theme}`;

    const answers = Object.values(data.answers || {});
    const index = data.currentIndex || 0;

    document.getElementById("answerText").textContent =
      answers[index] || "回答を待っています…";

 // ★ 新しい回答が来たら投票済み表示をリセット
  votedIcon.classList.add("hidden");

  });

  function vote(value) {
    db.ref(`rooms/${roomId}/votes/${userId}`).set(value);
    votedIcon.classList.remove("hidden");
  }

  yesBtn.onclick = () => vote("yes");
  noBtn.onclick = () => vote("no");
}

/* ============================================================
   result.html
============================================================ */
if (page === "result") {
  const nextBtn = document.getElementById("nextBtn");

  db.ref(`rooms/${roomId}`).on("value", snap => {
    const data = snap.val();
    if (!data) return;

    const answers = Object.values(data.answers || {});
    const index = data.currentIndex || 0;

    document.getElementById("currentAnswer").textContent = answers[index] || "回答なし";

    const votes = data.votes || {};
    const yesCount = Object.values(votes).filter(v => v === "yes").length;
    const noCount = Object.values(votes).filter(v => v === "no").length;

    document.getElementById("yesCount").textContent = yesCount;
    document.getElementById("noCount").textContent = noCount;

    const activeCount = Object.keys(data.users || {}).length;
    document.getElementById("activeCount").textContent = activeCount;

    const totalVoters = Object.values(votes).length;

    // ★ 修正ポイント：投票した人の中で YES が全員一致なら IPPON
    if (totalVoters > 0 && yesCount === totalVoters) {
      showIppon();
    }
  });

  nextBtn.onclick = () => {
    db.ref(`rooms/${roomId}/currentIndex`).transaction(n => (n || 0) + 1);
    db.ref(`rooms/${roomId}/votes`).set({});

    window.location.href = `answer.html?room=${roomId}`;
  };
}

/* ============================================================
   IPPON!! 演出
============================================================ */
function showIppon() {
  const ippon = document.getElementById("ipponEffect");
  const canvas = document.getElementById("confettiCanvas");

  ippon.classList.remove("hidden");
  ippon.style.animation = "ipponPop 5.0s forwards";

  canvas.classList.remove("hidden");
  startConfetti();

  setTimeout(() => {
    ippon.classList.add("hidden");
    canvas.classList.add("hidden");
  }, 5000);
}

/* ============================================================
   紙吹雪
============================================================ */
function startConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 80 }).map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: 5 + Math.random() * 5,
    speed: 2 + Math.random() * 3
  }));

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach(p => {
      p.y += p.speed;
      if (p.y > canvas.height) p.y = -10;

      ctx.fillStyle = ["#ff0", "#f00", "#0f0", "#0ff"][Math.floor(Math.random() * 4)];
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    requestAnimationFrame(update);
  }

  update();
}