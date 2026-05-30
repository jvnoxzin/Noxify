window.onload = () => {

setTimeout(() => {
document.getElementById("splash").style.display = "none";

if(localStorage.getItem("noxLogin")){
openApp();
}else{
document.getElementById("loginScreen").style.display = "flex";
}
}, 2500);

renderMusics();

};

/* =========================
   LOGIN
========================= */
async function login(){

const email = document.getElementById("user").value;
const pass = document.getElementById("pass").value;

try{

const userCredential =
await firebaseFunctions.signInWithEmailAndPassword(auth, email, pass);

const user = userCredential.user;

localStorage.setItem("noxLogin","true");
localStorage.setItem("loggedUser", user.displayName || user.email);

openApp();

}catch(error){
alert(error.message);
}

}

/* =========================
   REGISTER
========================= */
async function register(){

const name = document.getElementById("registerName").value;
const email = document.getElementById("registerEmail").value;
const pass = document.getElementById("registerPass").value;
const confirm = document.getElementById("registerConfirm").value;

if(pass !== confirm){
alert("As senhas não coincidem!");
return;
}

try{

const userCredential =
await firebaseFunctions.createUserWithEmailAndPassword(auth, email, pass);

await firebaseFunctions.updateProfile(userCredential.user, {
displayName: name
});

localStorage.setItem("noxLogin","true");
localStorage.setItem("loggedUser", name);

backToLogin();

}catch(error){
alert(error.message);
}

}

/* =========================
   OPEN APP (NÃO MEXE NO DESIGN)
========================= */
function openApp(){

document.getElementById("loginScreen").style.display = "none";
document.getElementById("registerScreen").style.display = "none";
document.getElementById("app").style.display = "block";

const user = auth.currentUser;

const name =
user?.displayName ||
localStorage.getItem("loggedUser") ||
"Usuário";

document.getElementById("userDisplay").innerText = name;

const avatar = document.querySelector(".user-avatar");
if(avatar) avatar.innerText = name.charAt(0).toUpperCase();

}

/* =========================
   LOGOUT
========================= */
async function logout(){
await firebaseFunctions.signOut(auth);
localStorage.clear();
location.reload();
}

/* =========================
   SCREENS
========================= */
function openRegister(){
document.getElementById("loginScreen").style.display = "none";
document.getElementById("registerScreen").style.display = "flex";
}

function backToLogin(){
document.getElementById("registerScreen").style.display = "none";
document.getElementById("loginScreen").style.display = "flex";
}

/* =========================
   PLAYLIST (SEM MEXER NO VISUAL)
========================= */
let playlist = [
{
name:"Starboy",
artist:"The Weeknd",
src:"Starboy.mp3",
cover:"https://upload.wikimedia.org/wikipedia/en/3/39/The_Weeknd_-_Starboy.png"
},
{
name:"One Of The Girls",
artist:"The Weeknd",
src:"One Of The Girls.mp3",
cover:"The Weeknd2.jpg"
},

{
name:"The Abyss",
artist:"The Weeknd",
src:"The Abyss.mp3",
cover:"The Weeknd3.jpg"
},
{
name:"House Of Balloons/Glass Table Girls",
artist:"The Weeknd",
src:"House Of Balloons.mp3",
cover:"The Weeknd.jpg"
},
{
name:"Wicked Games",
artist:"The Weeknd",
src:"Wicked Games.mp3",
cover:"The Weeknd.jpg"
},
{
name:"Coming Down",
artist:"The Weeknd",
src:"Coming Down.mp3",
cover:"The Weeknd.jpg"
},
{
name:"After Hours",
artist:"The Weeknd",
src:"After Hours.mp3",
cover:"The Weeknd5.jpg"
},
{
name:"Call Out My Name",
artist:"The Weeknd",
src:"Call Out My Name.mp3",
cover:"The Weeknd6.jpg"
},
{
name:"I Was Never There",
artist:"The Weeknd",
src:"I Was Never There.mp3",
cover:"The Weeknd6.jpg"
},
{
name:"The Hills",
artist:"The Weeknd",
src:"The Hills.mp3",
cover:"The Weeknd4.jpg"
},
{
name:"I Wanna Be Yours",
artist:"Arctic Monkeys",
src:"I Wanna Be Yours.mp3",
cover:"ArcticMonkeys.jpg"
},
{
name:"Do I Wanna Know?",
artist:"Arctic Monkeys",
src:"Do I Wanna Know.mp3",
cover:"ArcticMonkeys.jpg"
},
{
name:"R U Mine?",
artist:"Arctic Monkeys",
src:"R U Mine.mp3",
cover:"ArcticMonkeys.jpg"
},
{
name:"No. 1 Party Anthem",
artist:"Arctic Monkeys",
src:"No. 1 Party Anthem.mp3",
cover:"ArcticMonkeys.jpg"
},
{
name:"505",
artist:"Arctic Monkeys",
src:"505.mp3",
cover:"ArcticMonkeys3.jpg"
},
{
name:"Why'd You Only Call Me When You're High",
artist:"Arctic Monkeys",
src:"Why'd You Only Call Me When You're High.mp3",
cover:"ArcticMonkeys2.jpg"
},

{
name:"Into it",
artist:"Chase Atlantic",
src:"Into it.mp3",
cover:"ChaseAtlantic2.jpg"
},
{
name:"Swim",
artist:"Chase Atlantic",
src:"Swim.mp3",
cover:"ChaseAtlantic2.jpg"
},
{
name:"Consume",
artist:"Chase Atlantic",
src:"Consume.mp3",
cover:"ChaseAtlantic2.jpg"
},
{
name:"The Walls",
artist:"Chase Atlantic",
src:"The Walls.mp3",
cover:"ChaseAtlantic2.jpg"
},
{
name:"Slow Down",
artist:"Chase Atlantic",
src:"Slow Down.mp3",
cover:"ChaseAtlantic3.jpg"
},
{
name:"Friends",
artist:"Chase Atlantic",
src:"Friends.mp3",
cover:"ChaseAtlantic.jpg"
},
{
name:"Meddle About",
artist:"Chase Atlantic",
src:"Meddle About.mp3",
cover:"ChaseAtlantic4.jpg"
},
{
name:"SLOW DANCING IN THE DARK",
artist:"Joji",
src:"SLOW DANCING IN THE DARK.mp3",
cover:"Joji.jpg"
},
{
name:"Renegade",
artist:"Aaryan Shah",
src:"Renegade.mp3",
cover:"Renegade.jpg"
},
{
name:"Get You (feat. Kali Uchis)",
artist:"Daniel Caesar",
src:"Get You (feat Kali Uchis).mp3",
cover:"Daniel Caesar.jpg"
},
{
name:"Hold Me Down ",
artist:"Daniel Caesar",
src:"Hold Me Down.mp3",
cover:"Daniel Caesar.jpg"
},
{
name:"We Find Love",
artist:"Daniel Caesar",
src:"We Find Love.mp3",
cover:"Daniel Caesar.jpg"
},
{
name:"Loose",
artist:"Daniel Caesar",
src:"Loose.mp3",
cover:"Daniel Caesar.jpg"
},
{
name:"Best Part(feat. H.E.R)",
artist:"Daniel Caesar, H.E.R",
src:"Best Part.mp3",
cover:"Daniel Caesar.jpg"
},
{
name:"Who Hurt You?",
artist:"Daniel Caesar",
src:"Who Hurt You.mp3",
cover:"Daniel Caesar5.jpg"
},
{
name:"Love Again",
artist:"Daniel Caesar, Brandy",
src:"Love Again.mp3",
cover:"Daniel Caesar3.jpg"
},
{
name:"Japonese Denim",
artist:"Daniel Caesar",
src:"Japonese Denim.mp3",
cover:"Daniel Caesar4.jpg"
},
{
name:"Always",
artist:"Daniel Caesar",
src:"Always.mp3",
cover:"Daniel Caesar2.jpg"
},
{
name:"Superpowers",
artist:"Daniel Caesar",
src:"Superpowers.mp3",
cover:"Daniel Caesar2.jpg"
},
{
name:"Infrunami",
artist:"Steve Lacy",
src:"Infrunami.mp3",
cover:"Infrunami.jpg"
},
{
name:"Les",
artist:"Childish Gambino",
src:"Les.mp3",
cover:"Childish Gambino.jpg"
},
{
name:"Heartbeat",
artist:"Childish Gambino",
src:"Heartbeat.mp3",
cover:"Childish Gambino.jpg"
},
{
name:"NIGHTS LIKE THIS",
artist:"The Kid LAROI",
src:"NIGHTS LIKE THIS.mp3",
cover:"NIGHTS LIKE THIS.jpg"
},
{
name:"Aliança",
artist:"Tribalistas",
src:"Aliança.mp3",
cover:"Tribalistas.jpg"
},
{
name:"Imprevisto",
artist:"Yago Oproprio, Rô Rosa, Skeeter Beats",
src:"Imprevisto.mp3",
cover:"Imprevisto.jpg"
},
{
name:"Bem",
artist:"Chapéu de Palha",
src:"Bem.mp3",
cover:"Bem.jpg"
},
{
name:"Quando Bate Aquela Saudade",
artist:"Rubel",
src:"Quando Bate Aquela Saudade.mp3",
cover:"Rubel.jpg"
},
{
name:"Me Chamando de Paixão",
artist:"Jorge Ben Jor",
src:"Me Chamando de Paixão.mp3",
cover:"Me Chamando de Paixão.jpg"
},
{
name:"No Escuro",
artist:"Ana Gabriela",
src:"No Escuro.mp3",
cover:"AnaG.jpg"
},
{
name:"Outra Vida",
artist:"Armandinho",
src:"Outra Vida.mp3",
cover:"Armandinho.jpg"
},
{
name:"One Dance",
artist:"Drake",
src:"One Dance.mp3",
cover:"https://upload.wikimedia.org/wikipedia/en/a/af/Drake_-_Views_cover.jpg"
},
{
name:"Pink Matter",
artist:"Frank Ocean, André 3000",
src:"Pink Matter.mp3",
cover:"Frank Ocean.jpg"
},
{
name:"Pink + White",
artist:"Frank Ocean",
src:"PinkWhite.mp3",
cover:"Frank Ocean2.jpg"
},
{
name:"Ivy",
artist:"Frank Ocean",
src:"Ivy.mp3",
cover:"Frank Ocean2.jpg"
},
{
name:"Infinity",
artist:"Jaymes Young",
src:"Infinity.mp3",
cover:"Infinity.jpg"
},
{
name:"Sweater Weather",
artist:"The Neighbourhood",
src:"Sweater Weather.mp3",
cover:"Neighbourhood2.jpg"
},
{
name:"A Little Death",
artist:"The Neighbourhood",
src:"A Little Death.mp3",
cover:"Neighbourhood2.jpg"
},
{
name:"Afraid",
artist:"The Neighbourhood",
src:"Afraid.mp3",
cover:"Neighbourhood2.jpg"
},
{
name:"The Leaving Tonight",
artist:"The Neighbourhood",
src:"The Leaving Tonight.mp3",
cover:"Neighbourhood2.jpg"
},
{
name:"Softcore",
artist:"The Neighbourhood",
src:"Softcore.mp3",
cover:"Neighbourhood.jpg"
},
{
name:"Reflections",
artist:"The Neighbourhood",
src:"Reflections.mp3",
cover:"Neighbourhood.jpg"
},
{
name:"Daddy Issues",
artist:"The Neighbourhood",
src:"Daddy Issues.mp3",
cover:"Neighbourhood.jpg"
},
{
name:"Nervous",
artist:"The Neighbourhood",
src:"Nervous.mp3",
cover:"Neighbourhood.jpg"
}
];
const originalPlaylist = [...playlist];
/* =========================
   RENDER (NÃO ALTERA UI)
========================= */
function renderMusics(){

const musicList = document.getElementById("musicList");
musicList.innerHTML = "";
document.getElementById("musicCount").innerHTML =
"🎵 " + playlist.length + " músicas";
playlist.forEach((music,index)=>{

musicList.innerHTML += `
<div class="music-card" onclick="playMusic(${index})">

<div class="music-info">

<div class="music-cover"
style="background-image:url('${music.cover}')">
</div>

<div>
<div class="music-name">${music.name}</div>
<div class="artist">${music.artist}</div>
</div>

</div>

<div class="music-actions">

<button
class="queue-btn"
onclick="event.stopPropagation();addToQueue(${index})">
+
</button>

<button
class="play-btn"
onclick="event.stopPropagation(); playMusic(${index})">
▶
</button>
</div>

</div>
`;

});

}

/* =========================
   PLAYER
========================= */
const audio = document.getElementById("audio");
const currentMusic = document.getElementById("currentMusic");
const playBtn = document.getElementById("playBtn");
console.log(playBtn);

let currentIndex = 0;
let shuffleMode = false;
let queue = [];
function togglePlay(){

/* se nenhuma música foi iniciada */
if(audio.src === ""){

playMusic(currentIndex);

return;

}

if(audio.paused){

audio.play();

playBtn.innerHTML = "❚❚";

}else{

audio.pause();

playBtn.innerHTML = "▶";

}


}

function nextMusic(){

if(queue.length > 0){

const nextSong = queue.shift();

playMusic(nextSong);

renderQueue();

return;

}

if(shuffleMode){

currentIndex =
Math.floor(Math.random() * playlist.length);

}else{

currentIndex++;

if(currentIndex >= playlist.length){
currentIndex = 0;
}

}

playMusic(currentIndex);

}



function prevMusic(){
currentIndex--;
if(currentIndex < 0) currentIndex = playlist.length - 1;
playMusic(currentIndex);
}

audio.addEventListener("ended", nextMusic);
function playMusic(index) {

currentIndex = index;

audio.src = playlist[index].src;

audio.play();

audioContext.resume();

document.getElementById("nowCover").src =
playlist[index].cover;

currentMusic.innerHTML =
"🎧 Tocando: " + playlist[index].name;

playBtn.innerHTML = "❚❚";


}
/* =========================
   SEARCH (SEM BUG)
========================= */
function searchMusic(value){

const musicList = document.getElementById("musicList");
musicList.innerHTML = "";

playlist
.filter(m => m.name.toLowerCase().includes(value.toLowerCase()))
.forEach((music,index)=>{

musicList.innerHTML += `
<div class="music-card" onclick="playMusic(${index})">

<div class="music-info">

<div class="music-cover"
style="background-image:url('${music.cover}')">
</div>

<div>
<div class="music-name">${music.name}</div>
<div class="artist">${music.artist}</div>
</div>

</div>

<div class="music-actions">

<button
class="queue-btn"
onclick="event.stopPropagation();addToQueue(${index})">
+
</button>

<button
class="play-btn"
onclick="event.stopPropagation(); playMusic(${index})">
▶
</button>
</div>

</div>
`;

});

}
const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
for (let i = 0; i < 80; i++) {
particles.push({
x: Math.random() * canvas.width,
y: Math.random() * canvas.height,
r: Math.random() * 2,
dx: (Math.random() - 0.5) * 0.5,
dy: (Math.random() - 0.5) * 0.5
});
}

function animate() {
ctx.clearRect(0, 0, canvas.width, canvas.height);

for (let p of particles) {
p.x += p.dx;
p.y += p.dy;

if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
if (p.y < 0 || p.y > canvas.height) p.dy *= -1;

ctx.beginPath();
ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
ctx.fillStyle = "rgba(168,85,247,0.8)";
ctx.fill();
}

requestAnimationFrame(animate);
}

animate();

window.addEventListener("resize", () => {
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
});
const nowCover = document.getElementById("nowCover");

/* AUDIO CONTEXT */
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaElementSource(audio);

source.connect(analyser);
analyser.connect(audioContext.destination);

analyser.fftSize = 256;

const dataArray = new Uint8Array(analyser.frequencyBinCount);
const eqCanvas = document.getElementById("equalizer");
const eqCtx = eqCanvas.getContext("2d");

eqCanvas.width = window.innerWidth;
eqCanvas.height = 80;
function animateBeat() {
requestAnimationFrame(animateBeat);

analyser.getByteFrequencyData(dataArray);

/* soma frequências baixas (kick/bass) */
let bass = 0;
for (let i = 0; i < 20; i++) {
bass += dataArray[i];
}

bass = bass / 20;

/* efeito de pulso */
let scale = 1 + bass / 500;

nowCover.style.transform = `scale(${scale})`;
}

animateBeat();
drawEqualizer();
function drawEqualizer(){

requestAnimationFrame(drawEqualizer);

analyser.getByteFrequencyData(dataArray);

eqCtx.clearRect(
0,
0,
eqCanvas.width,
eqCanvas.height
);

const totalBars = 40;
const barWidth = 6;
const gap = 3;

const totalWidth =
totalBars * (barWidth + gap);

let x = (eqCanvas.width - totalWidth) / 2;

for(let i = 0; i < 40; i++){

const barHeight =
(dataArray[i] / 255) * 70;

const gradient =
eqCtx.createLinearGradient(
0,
80,
0,
0
);

gradient.addColorStop(0,"#6d28d9");
gradient.addColorStop(1,"#c084fc");

eqCtx.fillStyle = gradient;

eqCtx.fillRect(
x,
80 - barHeight,
barWidth,
barHeight
);

x += barWidth + gap;
}

}
function sortAZ(){

playlist.sort((a, b) => {
return a.name.localeCompare(b.name);
});

renderMusics();

}
function resetOrder(){

playlist = [...originalPlaylist];

renderMusics();

}
/* =========================
   PROGRESS BAR
========================= */

const progress = document.getElementById("progress");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");

/* atualiza duração quando carregar música */
audio.addEventListener("loadedmetadata", () => {

durationEl.innerText =
formatTime(audio.duration);

progress.value = 0;

});

/* atualizar barra */
audio.addEventListener("timeupdate", () => {

if (!isNaN(audio.duration)) {

let percent =
(audio.currentTime / audio.duration) * 100;

progress.value = percent;

currentTimeEl.innerText =
formatTime(audio.currentTime);

}

});

/* mover música pela barra */
progress.addEventListener("input", () => {

if (!isNaN(audio.duration)) {

audio.currentTime =
(progress.value / 100) * audio.duration;

}

});

/* formatar tempo */
function formatTime(time){

let minutes = Math.floor(time / 60);
let seconds = Math.floor(time % 60);

if(seconds < 10){
seconds = "0" + seconds;
}

return `${minutes}:${seconds}`;

}
function toggleShuffle(){

shuffleMode = !shuffleMode;

const shuffleBtn =
document.getElementById("shuffleBtn");

if(shuffleMode){

shuffleBtn.innerHTML = "⤮ ON";

}else{

shuffleBtn.innerHTML = "⤮ OFF";
}
}
function addToQueue(index){

queue.push(index);

showToast("🎵 Adicionada à fila");

renderQueue();

}
function renderQueue(){

const queueList = document.getElementById("queueList");

if(!queueList) return;

queueList.innerHTML = "";

queue.forEach((musicIndex)=>{

queueList.innerHTML += `
<div class="queue-item">
${playlist[musicIndex].name}
</div>
`;
});
}
function showToast(message){

const toast = document.getElementById("toast");

toast.innerText = message;

toast.classList.add("show");

setTimeout(() => {
toast.classList.remove("show");
}, 2000);

}