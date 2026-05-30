<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NoxPlay</title>

<link rel="stylesheet" href="style.css"/>
</head>

<body>

<!-- SPLASH -->
<div class="splash" id="splash">
  <div class="splash-logo">N</div>
  <div class="splash-title">NoxPlay</div>
  <div class="splash-sub">Neon Music Experience</div>
</div>

<canvas id="particles"></canvas>

<!-- LOGIN -->
<div class="login-screen" id="loginScreen">
  <div class="login-box">
    <div class="login-logo">N</div>
    <div class="login-title">NoxPlay</div>

    <input id="user" type="email" class="input" placeholder="Email"/>
    <input id="pass" type="password" class="input" placeholder="Senha"/>

    <button class="login-btn" onclick="login()">Entrar</button>
    <button class="login-btn register-btn" onclick="openRegister()">Criar Conta</button>
  </div>
</div>

<!-- REGISTER -->
<div class="login-screen" id="registerScreen" style="display:none;">
  <div class="login-box">
    <div class="login-logo">N</div>
    <div class="login-title">Criar Conta</div>

    <input id="registerEmail" type="email" class="input" placeholder="Email"/>
    <input id="registerPass" type="password" class="input" placeholder="Senha"/>
    <input id="registerConfirm" type="password" class="input" placeholder="Confirmar senha"/>

    <button class="login-btn" onclick="register()">Cadastrar</button>
    <button class="login-btn register-btn" onclick="backToLogin()">Voltar</button>
  </div>
</div>

<!-- APP -->
<div class="app" id="app">

  <div class="main">

    <div class="banner">
      <div class="album"></div>
      <div>
        <p>Experiência Premium</p>
        <h1>NoxPlay</h1>
        <p>Seu player neon estilo Spotify</p>
      </div>
    </div>

    <div class="user-bar">
      <div class="user-avatar">N</div>
      <div class="user-info">
        <div class="user-name" id="userDisplay">Usuário</div>
        <div class="user-status">Premium User</div>
      </div>
    </div>

    <div class="top-actions">
      <button onclick="sortAZ()">A-Z</button>
      <button onclick="logout()">Sair</button>
    </div>

    <input class="search" placeholder="Buscar músicas..." onkeyup="searchMusic(this.value)"/>

    <div class="playlist-title">Playlist Principal</div>
    <div id="musicList"></div>

  </div>

  <div class="visualizer">
    <span></span><span></span><span></span><span></span>
    <span></span><span></span><span></span><span></span>
  </div>

  <div class="player">
    <div id="currentMusic">Nenhuma música tocando</div>

    <div class="controls">
      <button onclick="prevMusic()">⏮</button>
      <button onclick="togglePlay()" id="playBtn">▶</button>
      <button onclick="nextMusic()">⏭</button>

      <audio id="audio" controls></audio>
    </div>
  </div>

</div>

<!-- 🔥 FIREBASE (CARREGA PRIMEIRO) -->
<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "