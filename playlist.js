/* =========================================================
   NOXIFY — playlist.js
   Só os dados das músicas. Para adicionar uma música, copie
   uma linha, troque os campos e coloque o .mp3 e a capa na
   mesma pasta do site.
========================================================= */

const PLAYLIST = [

  /* The Weeknd */
  { name:"Starboy", artist:"The Weeknd", src:"Starboy.mp3", cover:"https://upload.wikimedia.org/wikipedia/en/3/39/The_Weeknd_-_Starboy.png" },
  { name:"One Of The Girls", artist:"The Weeknd", src:"One Of The Girls.mp3", cover:"The Weeknd2.jpg" },
  { name:"The Abyss", artist:"The Weeknd", src:"The Abyss.mp3", cover:"The Weeknd3.jpg" },
  { name:"House Of Balloons/Glass Table Girls", artist:"The Weeknd", src:"House Of Balloons.mp3", cover:"The Weeknd.jpg" },
  { name:"Wicked Games", artist:"The Weeknd", src:"Wicked Games.mp3", cover:"The Weeknd.jpg" },
  { name:"Coming Down", artist:"The Weeknd", src:"Coming Down.mp3", cover:"The Weeknd.jpg" },
  { name:"After Hours", artist:"The Weeknd", src:"After Hours.mp3", cover:"The Weeknd5.jpg" },
  { name:"Call Out My Name", artist:"The Weeknd", src:"Call Out My Name.mp3", cover:"The Weeknd6.jpg" },
  { name:"I Was Never There", artist:"The Weeknd", src:"I Was Never There.mp3", cover:"The Weeknd6.jpg" },
  { name:"The Hills", artist:"The Weeknd", src:"The Hills.mp3", cover:"The Weeknd4.jpg" },

  /* Arctic Monkeys */
  { name:"I Wanna Be Yours", artist:"Arctic Monkeys", src:"I Wanna Be Yours.mp3", cover:"ArcticMonkeys.jpg" },
  { name:"Do I Wanna Know?", artist:"Arctic Monkeys", src:"Do i wanna know.mp3", cover:"ArcticMonkeys.jpg" },
  { name:"R U Mine?", artist:"Arctic Monkeys", src:"R U Mine.mp3", cover:"ArcticMonkeys.jpg" },
  { name:"No. 1 Party Anthem", artist:"Arctic Monkeys", src:"No. 1 Party Anthem.mp3", cover:"ArcticMonkeys.jpg" },
  { name:"505", artist:"Arctic Monkeys", src:"505.mp3", cover:"ArcticMonkeys3.jpg" },
  { name:"Why'd You Only Call Me When You're High", artist:"Arctic Monkeys", src:"Why'd You Only Call Me When You're High.mp3", cover:"ArcticMonkeys2.jpg" },

  /* Chase Atlantic */
  { name:"Into it", artist:"Chase Atlantic", src:"Into it.mp3", cover:"ChaseAtlantic2.jpg" },
  { name:"Swim", artist:"Chase Atlantic", src:"Swim.mp3", cover:"ChaseAtlantic2.jpg" },
  { name:"Consume", artist:"Chase Atlantic", src:"Consume.mp3", cover:"ChaseAtlantic2.jpg" },
  { name:"The Walls", artist:"Chase Atlantic", src:"The Walls.mp3", cover:"ChaseAtlantic2.jpg" },
  { name:"Slow Down", artist:"Chase Atlantic", src:"Slow Down.mp3", cover:"ChaseAtlantic3.jpg" },
  { name:"Friends", artist:"Chase Atlantic", src:"Friends.mp3", cover:"ChaseAtlantic.jpg" },
  { name:"Meddle About", artist:"Chase Atlantic", src:"Meddle About.mp3", cover:"ChaseAtlantic4.jpg" },

  /* Joji / Aaryan Shah */
  { name:"SLOW DANCING IN THE DARK", artist:"Joji", src:"SLOW DANCING IN THE DARK.mp3", cover:"Joji.jpg" },
  { name:"Renegade", artist:"Aaryan Shah", src:"Renegade.mp3", cover:"Renegade.jpg" },

  /* Daniel Caesar */
  { name:"Get You (feat. Kali Uchis)", artist:"Daniel Caesar", src:"Get You (feat Kali Uchis).mp3", cover:"Daniel Caesar.jpg" },
  { name:"Hold Me Down", artist:"Daniel Caesar", src:"Hold Me Down.mp3", cover:"Daniel Caesar.jpg" },
  { name:"We Find Love", artist:"Daniel Caesar", src:"We Find Love.mp3", cover:"Daniel Caesar.jpg" },
  { name:"Loose", artist:"Daniel Caesar", src:"Loose.mp3", cover:"Daniel Caesar.jpg" },
  { name:"Best Part(feat. H.E.R)", artist:"Daniel Caesar, H.E.R", src:"Best Part.mp3", cover:"Daniel Caesar.jpg" },
  { name:"Who Hurt You?", artist:"Daniel Caesar", src:"Who Hurt You.mp3", cover:"Daniel Caesar5.jpg" },
  { name:"Love Again", artist:"Daniel Caesar, Brandy", src:"Love Again.mp3", cover:"Daniel Caesar3.jpg" },
  { name:"Japanese Denim", artist:"Daniel Caesar", src:"Japanese Denim.mp3", cover:"Daniel Caesar4.jpg" },
  { name:"Always", artist:"Daniel Caesar", src:"Always.mp3", cover:"Daniel Caesar2.jpg" },
  { name:"Superpowers", artist:"Daniel Caesar", src:"Superpowers.mp3", cover:"Daniel Caesar2.jpg" },

  /* Steve Lacy / Childish Gambino / The Kid LAROI */
  { name:"Infrunami", artist:"Steve Lacy", src:"Infrunami.mp3", cover:"Infrunami.jpg" },
  { name:"Les", artist:"Childish Gambino", src:"Les.mp3", cover:"Childish Gambino.jpg" },
  { name:"Heartbeat", artist:"Childish Gambino", src:"Heartbeat.mp3", cover:"Childish Gambino.jpg" },
  { name:"NIGHTS LIKE THIS", artist:"The Kid LAROI", src:"NIGHTS LIKE THIS.mp3", cover:"NIGHTS LIKE THIS.jpg" },

  /* Brasil */
  { name:"Aliança", artist:"Tribalistas", src:"Aliança.mp3", cover:"Tribalistas.jpg" },
  { name:"Imprevisto", artist:"Yago Oproprio, Rô Rosa, Skeeter Beats", src:"Imprevisto.mp3", cover:"Imprevisto.jpg" },
  { name:"Bem", artist:"Chapéu de Palha", src:"Bem.mp3", cover:"Bem.jpg" },
  { name:"Quando Bate Aquela Saudade", artist:"Rubel", src:"Quando Bate Aquela Saudade.mp3", cover:"Rubel.jpg" },
  { name:"Me Chamando de Paixão", artist:"Jorge Ben Jor", src:"Me Chamando de Paixão.mp3", cover:"Me Chamando de Paixão.jpg" },
  { name:"No Escuro", artist:"Ana Gabriela", src:"No Escuro.mp3", cover:"AnaG.jpg" },
  { name:"Outra Vida", artist:"Armandinho", src:"Outra Vida.mp3", cover:"Armandinho.jpg" },

  /* Drake / Frank Ocean / Jaymes Young */
  { name:"One Dance", artist:"Drake", src:"One dance.mp3", cover:"https://upload.wikimedia.org/wikipedia/en/a/af/Drake_-_Views_cover.jpg" },
  { name:"Pink Matter", artist:"Frank Ocean, André 3000", src:"Pink Matter.mp3", cover:"Frank Ocean.jpg" },
  { name:"Pink + White", artist:"Frank Ocean", src:"PinkWhite.mp3", cover:"Frank Ocean2.jpg" },
  { name:"Ivy", artist:"Frank Ocean", src:"Ivy.mp3", cover:"Frank Ocean2.jpg" },
  { name:"Infinity", artist:"Jaymes Young", src:"Infinity.mp3", cover:"Infinity.jpg" },

  /* The Neighbourhood */
  { name:"Sweater Weather", artist:"The Neighbourhood", src:"Sweater Weather.mp3", cover:"Neighbourhood2.jpg" },
  { name:"A Little Death", artist:"The Neighbourhood", src:"A Little Death.mp3", cover:"Neighbourhood2.jpg" },
  { name:"Afraid", artist:"The Neighbourhood", src:"Afraid.mp3", cover:"Neighbourhood2.jpg" },
  { name:"The Leaving Tonight", artist:"The Neighbourhood", src:"The  Leaving Tonight.mp3", cover:"Neighbourhood2.jpg" },
  { name:"Softcore", artist:"The Neighbourhood", src:"Softcore.mp3", cover:"Neighbourhood.jpg" },
  { name:"Reflections", artist:"The Neighbourhood", src:"Reflections.mp3", cover:"Neighbourhood.jpg" },
  { name:"Daddy Issues", artist:"The Neighbourhood", src:"Daddy Issues.mp3", cover:"Neighbourhood.jpg" },
  { name:"Nervous", artist:"The Neighbourhood", src:"Nervous.mp3", cover:"Neighbourhood.jpg" }

];
