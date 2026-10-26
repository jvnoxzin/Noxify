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
  { name:"Nervous", artist:"The Neighbourhood", src:"Nervous.mp3", cover:"Neighbourhood.jpg" },

  /* Adicionadas em 26/10/2026 */
  { name:"A Droga do Amor", artist:"Ari, Felipe Play, Dom R", src:"A Droga do Amor.mp3", cover:"Ari.jpg" },
  { name:"Amor Dos Deuses", artist:"Grupo Fundo De Quintal", src:"Amor Dos Deuses.mp3", cover:"Grupo Fundo De Quintal.jpg" },
  { name:"Sincera - Ao Vivo", artist:"Art Popular", src:"Sincera - Ao Vivo.mp3", cover:"Art Popular.jpg" },
  { name:"Desliga E Vem", artist:"Exaltasamba", src:"Desliga E Vem.mp3", cover:"Exaltasamba.jpg" },
  { name:"Trust Issues", artist:"Drake", src:"Trust Issues.mp3", cover:"Drake.jpg" },
  { name:"É Você", artist:"Exaltasamba", src:"É Você.mp3", cover:"Exaltasamba 2.jpg" },
  { name:"Me Namora", artist:"Edu Ribeiro", src:"Me Namora.mp3", cover:"Edu Ribeiro.jpg" },
  { name:"Quero Ser Feliz Também", artist:"Natiruts", src:"Quero Ser Feliz Também.mp3", cover:"Natiruts.jpg" },
  { name:"Me Leva Junto Com Você", artist:"Raça Negra", src:"Me Leva Junto Com Você.mp3", cover:"Raça Negra.jpg" },
  { name:"Quando Te Encontrei", artist:"Raça Negra", src:"Quando Te Encontrei.mp3", cover:"Raça Negra 2.jpg" },
  { name:"Meu Jeito de Ser", artist:"Só Pra Contrariar", src:"Meu Jeito de Ser.mp3", cover:"Só Pra Contrariar.jpg" },
  { name:"Jeito Felino", artist:"Raça Negra", src:"Jeito Felino.mp3", cover:"Raça Negra 3.jpg" },
  { name:"Flawless", artist:"The Neighbourhood", src:"Flawless.mp3", cover:"The Neighbourhood.jpg" },

  /* Adicionadas em 26/10/2026 */
  { name:"penumbra", artist:"Djonga, Rapaz do Dread, Sarah Guedes", src:"penumbra.mp3", cover:"Djonga.jpg" },
  { name:"Perdição", artist:"L7NNON", src:"Perdição.mp3", cover:"L7NNON.jpg" },
  { name:"Arde Outra Vez", artist:"Thalles Roberto", src:"Arde Outra Vez.mp3", cover:"Thalles Roberto.jpg" },
  { name:"Beatriz", artist:"2ZDinizz, Leborato, HHR", src:"Beatriz.mp3", cover:"2ZDinizz.jpg" },
  { name:"The Lazy Song", artist:"Bruno Mars", src:"The Lazy Song.mp3", cover:"Bruno Mars.jpg" },
  { name:"Burguesinha", artist:"Seu Jorge", src:"Burguesinha.mp3", cover:"Seu Jorge.jpg" },
  { name:"Can't Take My Eyes off You", artist:"Frankie Valli", src:"Can't Take My Eyes off You.mp3", cover:"Frankie Valli.jpg" },
  { name:"Quero Te Encontrar", artist:"Claudinho & Buchecha", src:"Quero Te Encontrar.mp3", cover:"Claudinho & Buchecha.jpg" },
  { name:"Eu Te Devoro", artist:"Djavan", src:"Eu Te Devoro.mp3", cover:"Djavan.jpg" },
  { name:"Se...", artist:"Djavan", src:"Se....mp3", cover:"Djavan 2.jpg" },
  { name:"Um Amor Puro", artist:"Djavan", src:"Um Amor Puro.mp3", cover:"Djavan 3.jpg" },
  { name:"E o teu coração?", artist:"Derxan", src:"E o teu coração.mp3", cover:"Derxan.jpg" },
  { name:"Eu Juro", artist:"Armandinho", src:"Eu Juro.mp3", cover:"Armandinho (2).jpg" },
  { name:"Feminina", artist:"Athalyba E A Firma", src:"Feminina.mp3", cover:"Athalyba E A Firma.jpg" },
  { name:"Foi assim", artist:"Sotam, Rob", src:"Foi assim.mp3", cover:"Sotam.jpg" },
  { name:"Me Ama", artist:"Israel Salazar", src:"Me Ama.mp3", cover:"Israel Salazar.jpg" },
  { name:"Luz Que Me Traz Paz", artist:"Maneva", src:"Luz Que Me Traz Paz.mp3", cover:"Maneva.jpg" },
  { name:"333", artist:"Matuê", src:"333.mp3", cover:"Matuê.jpg" },
  { name:"Máquina do Tempo", artist:"Matuê", src:"Máquina do Tempo.mp3", cover:"Matuê 2.jpg" },
  { name:"Melhor Lugar", artist:"Jorge Vercillo", src:"Melhor Lugar.mp3", cover:"Jorge Vercillo.jpg" },
  { name:"Sorri, Sou Rei (feat. Claudia Leitte)", artist:"Natiruts, Claudia Leitte", src:"Sorri, Sou Rei (feat. Claudia Leitte).mp3", cover:"Natiruts (2).jpg" },
  { name:"Nunca se acabe", artist:"Derxan", src:"Nunca se acabe.mp3", cover:"Derxan.jpg" },
  { name:"Anjos (Pra quem tem fé) - Ao vivo", artist:"O Rappa", src:"Anjos (Pra quem tem fé) - Ao vivo.mp3", cover:"O Rappa.jpg" },
  { name:"Minha alma (A paz que eu não quero)", artist:"O Rappa", src:"Minha alma (A paz que eu não quero).mp3", cover:"O Rappa 2.jpg" },
  { name:"Pra Você", artist:"Onze:20", src:"Pra Você.mp3", cover:"Onze 20.jpg" },
  { name:"Outro Dia", artist:"A Banca Records, Lourena, Azzy, Mazin, Black", src:"Outro Dia.mp3", cover:"A Banca Records.jpg" },
  { name:"Pisando Descalço", artist:"Maneva", src:"Pisando Descalço.mp3", cover:"Maneva 2.jpg" },
  { name:"Poesia Acústica #6: Era uma Vez", artist:"Pineapple StormTv, MC Cabelinho, Bob do Contra, Azzy, Filipe Ret, Dudu, Xamã, Orochi, Maquiny, Salve Malak", src:"Poesia Acústica 6 Era uma Vez.mp3", cover:"Pineapple StormTv.jpg" },
  { name:"Menina Veneno", artist:"Ritchie", src:"Menina Veneno.mp3", cover:"Ritchie.jpg" },
  { name:"Se fosse", artist:"Derxan", src:"Se fosse.mp3", cover:"Derxan.jpg" },
  { name:"Segredos - Frejat", artist:"Warner Music Brasil", src:"Segredos - Frejat.mp3", cover:"Warner Music Brasil.jpg" },
  { name:"Skank - Acima do Sol", artist:"Heart's Hits", src:"Skank - Acima do Sol [HQ].mp3", cover:"Heart's Hits.jpg" },
  { name:"Ainda Gosto Dela", artist:"Skank", src:"Ainda Gosto Dela.mp3", cover:"Skank.jpg" },
  { name:"Resposta", artist:"Skank", src:"Resposta.mp3", cover:"Skank 2.jpg" },
  { name:"Te Ver", artist:"Skank", src:"Te Ver.mp3", cover:"Skank 3.jpg" },
  { name:"Vou Deixar", artist:"Skank", src:"Vou Deixar.mp3", cover:"Skank 4.jpg" },
  { name:"Sutilmente", artist:"Skank", src:"Sutilmente.mp3", cover:"Skank 5.jpg" },
  { name:"Que Se Chama Amor", artist:"Só Pra Contrariar", src:"Que Se Chama Amor.mp3", cover:"Só Pra Contrariar (2).jpg" },
  { name:"Sozinho - Ao Vivo", artist:"Caetano Veloso", src:"Sozinho - Ao Vivo.mp3", cover:"Caetano Veloso.jpg" },
  { name:"Sozinho", artist:"Raça Negra", src:"Sozinho.mp3", cover:"Raça Negra (2).jpg" },
  { name:"Coisas Que Eu Sei", artist:"Jorge Vercillo", src:"Coisas Que Eu Sei.mp3", cover:"Jorge Vercillo 2.jpg" },
  { name:"Já Sei Namorar", artist:"Tribalistas", src:"Já Sei Namorar.mp3", cover:"Tribalistas (2).jpg" },
  { name:"Velha Infância - 2004 Digital Remaster", artist:"Tribalistas", src:"Velha Infância - 2004 Digital Remaster.mp3", cover:"Tribalistas 2.jpg" },
  { name:"Tu Mandas No Meu Coração", artist:"Os Travessos", src:"Tu Mandas No Meu Coração.mp3", cover:"Os Travessos.jpg" }

];
