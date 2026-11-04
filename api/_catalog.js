/* =========================================================
   NOXIFY — api/_catalog.js
   Catálogo da Noxify Store. Fica SÓ no servidor: preços e itens
   não vêm do navegador, então ninguém consegue baratear uma compra.
   (arquivo com "_" no começo: a Vercel não cria rota para ele)

   Para adicionar um item: copie uma linha, mude o id (único!),
   o nome e o preço e publique de novo. A aparência (cores,
   animação) de cada id fica em store.css / store.js.
========================================================= */

const TZ = "America/Sao_Paulo";                       // fuso usado nas recompensas
const DAILY = [10, 15, 20, 25, 30, 35, 50];           // dia 1..7 (depois reinicia)

const CATS = ["frame", "effect", "banner", "name", "badge", "theme"];

/* free: já vem com todo mundo | src: "mission" = só se ganha, não se compra */
const ITEMS = [
  /* molduras */
  { id: "fr_default",   cat: "frame",  name: "Padrão",          desc: "Sem moldura. A foto limpa.", price: 0, free: true },
  { id: "fr_neon",      cat: "frame",  name: "Neon Roxa",       desc: "Tubo de neon roxo com faíscas e um ponto de luz orbitando.", price: 500 },
  { id: "fr_cosmic",    cat: "frame",  name: "Cósmica",         desc: "Anel de galáxia com poeira de estrelas e um planeta em órbita.", price: 800 },
  { id: "fr_fire",      cat: "frame",  name: "Fogo",            desc: "Coroa de chamas vivas com brasas subindo.", price: 800 },
  { id: "fr_futur",     cat: "frame",  name: "Futurista",       desc: "Painel HUD ciano com segmentos giratórios e varredura.", price: 1000 },
  { id: "fr_aurora",    cat: "frame",  name: "Aurora",          desc: "Fitas de aurora boreal mudando de cor ao girar.", price: 1200 },
  { id: "fr_particles", cat: "frame",  name: "Partículas",      desc: "Nuvens de luz em três órbitas brilhando.", price: 1500 },
  { id: "fr_special",   cat: "frame",  name: "Imperial",        desc: "Moldura exclusiva: ouro e carmesim com louros, joias e coroa.", price: 5000 },

  /* efeitos de tela */
  { id: "fx_none",      cat: "effect", name: "Nenhum",          desc: "Sem efeitos na tela.", price: 0, free: true },
  { id: "fx_particles", cat: "effect", name: "Partículas roxas", desc: "Luzes roxas subindo e balançando, com brilho suave.", price: 300 },
  { id: "fx_lightning", cat: "effect", name: "Raios neon",      desc: "Relâmpagos neon com clarão, caindo dos cantos.", price: 400 },
  { id: "fx_stars",     cat: "effect", name: "Estrelas",        desc: "Estrelas cintilando e uma estrela cadente.", price: 300 },
  { id: "fx_waves",     cat: "effect", name: "Ondas futuristas", desc: "Pulsos de radar ciano e roxo saindo dos cantos.", price: 450 },
  { id: "fx_smoke",     cat: "effect", name: "Fumaça",          desc: "Névoa roxa em camadas subindo e se enrolando.", price: 350 },
  { id: "fx_cosmic",    cat: "effect", name: "Cósmico",         desc: "Nebulosa, planeta com anel e cometa nos cantos.", price: 600 },
  { id: "fx_glow",      cat: "effect", name: "Brilho",          desc: "Aura com raios de luz e cintilações.", price: 250 },

  /* banners */
  { id: "bn_neon",      cat: "banner", name: "Neon",            desc: "Pôr do sol synthwave: sol listrado e grade neon em movimento.", price: 400 },
  { id: "bn_aurora",    cat: "banner", name: "Aurora",          desc: "Aurora boreal dançando sobre as montanhas, com estrelas cadentes.", price: 400 },
  { id: "bn_cosmic",    cat: "banner", name: "Cósmico",         desc: "Nebulosa viva, planeta com anel, lua em órbita e estrelas cadentes.", price: 600 },
  { id: "bn_futur",     cat: "banner", name: "Futurista",       desc: "Painel futurista com anéis giratórios, circuitos pulsando e varredura.", price: 600 },
  { id: "bn_abstract",  cat: "banner", name: "Abstrato",        desc: "Luz líquida em movimento: cores que se misturam e flutuam.", price: 500 },
  { id: "bn_special",   cat: "banner", name: "Imperial",        desc: "Capa imperial: veludo carmesim, ouro, coroa e louros. Raios e pó de ouro animados.", price: 3000 },

  /* estilos de nome */
  { id: "nm_default",   cat: "name",   name: "Padrão",          desc: "Nome normal.", price: 0, free: true },
  { id: "nm_grad",      cat: "name",   name: "Gradiente roxo",  desc: "Nome com degradê roxo.", price: 300 },
  { id: "nm_neon",      cat: "name",   name: "Neon",            desc: "Nome com brilho neon.", price: 400 },
  { id: "nm_glow",      cat: "name",   name: "Brilho",          desc: "Nome com halo de luz.", price: 400 },
  { id: "nm_shadow",    cat: "name",   name: "Sombra",          desc: "Nome com sombra marcada.", price: 250 },
  { id: "nm_aurora",    cat: "name",   name: "Aurora",          desc: "Nome com cores de aurora.", price: 600 },
  { id: "nm_futur",     cat: "name",   name: "Futurista",       desc: "Nome ciano com contorno tech.", price: 500 },

  /* emblemas (alguns só se ganham em missões) */
  { id: "bd_none",      cat: "badge",  name: "Nenhum",          desc: "Sem emblema.", price: 0, free: true },
  { id: "bd_rookie",    cat: "badge",  name: "Primeiro passo",  desc: "Resgatou a primeira recompensa diária.", price: 0, src: "mission" },
  { id: "bd_listener",  cat: "badge",  name: "Ouvinte",         desc: "Completou a missão de ouvir música.", price: 0, src: "mission" },
  { id: "bd_group",     cat: "badge",  name: "Sociável",        desc: "Entrou em um grupo.", price: 0, src: "mission" },
  { id: "bd_fire7",     cat: "badge",  name: "Sequência 7",     desc: "7 dias seguidos no Noxify.", price: 0, src: "mission" },
  { id: "bd_star",      cat: "badge",  name: "Estrela",         desc: "Uma estrela roxa ao lado do nome.", price: 200 },
  { id: "bd_crown",     cat: "badge",  name: "Coroa",           desc: "Coroa dourada para quem manda.", price: 1500 },
  { id: "bd_diamond",   cat: "badge",  name: "Diamante",        desc: "Diamante neon raro.", price: 3000 },
  { id: "bd_owner",     cat: "badge",  name: "Dono do Noxify",  desc: "Exclusivo do criador do Noxify.", price: 0, src: "owner" },

  /* temas do app */
  { id: "th_default",   cat: "theme",  name: "Noxify Roxo",     desc: "O visual original.", price: 0, free: true },
  { id: "th_midnight",  cat: "theme",  name: "Meia-noite",      desc: "Azul profundo com detalhes ciano.", price: 700 },
  { id: "th_rose",      cat: "theme",  name: "Rosa Cyber",      desc: "Preto com rosa neon.", price: 700 },
  { id: "th_matrix",    cat: "theme",  name: "Matrix",          desc: "Preto com verde neon.", price: 700 },
  { id: "th_gold",      cat: "theme",  name: "Ouro",            desc: "Preto com dourado elegante.", price: 1200 }
];

const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/* o item "nenhum" de cada categoria (usado ao desequipar) */
const DEFAULT_OF = { frame: "fr_default", effect: "fx_none", banner: null, name: "nm_default", badge: "bd_none", theme: "th_default" };

/* missões: period "day" zera todo dia, "once" só uma vez na vida */
const MISSIONS = [
  { id: "m_login",    name: "Entrar no Noxify",       desc: "Abra o Noxify hoje.",                 period: "day",  target: 1, reward: 5 },
  { id: "m_listen",   name: "Ouvir uma música",       desc: "Toque uma música hoje.",              period: "day",  target: 1, reward: 10, item: "bd_listener" },
  { id: "m_playlist", name: "Criar uma playlist",     desc: "Crie sua primeira playlist.",         period: "once", target: 1, reward: 30 },
  { id: "m_group",    name: "Participar de um grupo", desc: "Entre ou crie um grupo.",             period: "once", target: 1, reward: 30, item: "bd_group" },
  { id: "m_streak7",  name: "Sequência de 7 dias",    desc: "Resgate a recompensa 7 dias seguidos.", period: "once", target: 7, reward: 100, item: "bd_fire7" }
];

module.exports = { TZ, DAILY, CATS, ITEMS, BY_ID, DEFAULT_OF, MISSIONS };
