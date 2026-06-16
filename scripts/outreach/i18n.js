'use strict';

/**
 * MarginSync outreach — localization.
 *
 * The first email is deliberately tiny: one personal line about THEIR review,
 * then a single question, no pitch and no link. We localise the whole message
 * (subject, body, replies, follow-ups, onboarding, Instagram) to the language
 * we infer from the reviewer's country, falling back to English.
 *
 * Adding a language = add one entry to LANG_BY_COUNTRY and one block to MESSAGES.
 */

// Country string as it appears in Shopify App Store reviews → language code.
const LANG_BY_COUNTRY = {
  // Indonesian
  'indonesia': 'id',
  // German
  'germany': 'de', 'austria': 'de', 'switzerland': 'de',
  // Spanish
  'spain': 'es', 'mexico': 'es', 'argentina': 'es', 'colombia': 'es',
  'chile': 'es', 'peru': 'es', 'ecuador': 'es', 'venezuela': 'es',
  'guatemala': 'es', 'bolivia': 'es', 'dominican republic': 'es',
  'uruguay': 'es', 'paraguay': 'es', 'costa rica': 'es', 'panama': 'es',
  // French
  'france': 'fr', 'belgium': 'fr', 'luxembourg': 'fr',
  // Portuguese
  'portugal': 'pt', 'brazil': 'pt',
};

function detectLanguage(country) {
  if (!country) return 'en';
  return LANG_BY_COUNTRY[country.trim().toLowerCase()] || 'en';
}

// Helper: " in France" / " di Indonesia" (with a leading space so it appends
// cleanly), or "" when we don't know the country.
function loc(prep, country) { return country ? ` ${prep} ${country}` : ''; }

const MESSAGES = {
  // ── English (default) ────────────────────────────────────────────────────────
  en: {
    subject: app => `quick question after your ${app} review`,
    coldEmail: ({ app, quote }) => {
      const q = quote ? `\n\nYou wrote: "${quote}"` : '';
      return `Hi there,

I read your ${app} review — sounds like keeping prices in sync has been more painful than it should be.${q}

One quick question, and honestly that's all this is: do you update your supplier prices into Shopify by hand? And roughly how long does that take you each week?

No pitch — I'm just trying to understand how store owners really handle this.

Hughez

(Not relevant? Just reply STOP and I won't write again.)`;
    },
    replyLink: url => `Thanks for getting back to me — really appreciate it.

If you'd like to try it, here's MarginSync:
  ${url}
Sign in with your Shopify store and your first supplier-price sync takes about two minutes. Any questions, just reply here.

Hughez`,
    optoutAck: () => `No problem at all — I've taken you off the list and won't write again.\n\nHughez`,
    notInterestedAck: () => `Totally fair — thanks for the reply, and best of luck with the store.\n\nHughez`,
    followUp: () => `Hi there,

Just following up in case my last note got buried — no worries if it's not for you.

Still genuinely curious though: do you update supplier prices into Shopify by hand, and how long does it take you each week?

Hughez`,
    formOnboarding: (name, url) => `Hi ${name},

Thanks for signing up for MarginSync — glad you're in.

Here's your link:
  ${url}
Sign in with your Shopify store and you can run your first supplier-price sync straight away (about two minutes). If anything looks off, just reply here.

Hughez`,
    igOpener: (name, product, country) => `Hi ${name}! Came across your ${product} store${loc('in', country)} — really nice range.`,
    igQuestion: () => `Quick one — when your suppliers send updated price lists, do you put those into Shopify by hand? Always curious how shop owners handle it.`,
    igPitch: () => `Makes sense. I built a little tool called MarginSync — you upload the supplier CSV and it maps the new prices onto your Shopify products, with a full preview before anything goes live. Free while it's in beta. Worth a look?`,
    igLink: url => `Here's the link — about five minutes to connect: ${url}`,
  },

  // ── Bahasa Indonesia ───────────────────────────────────────────────────────────
  id: {
    subject: app => `pertanyaan singkat soal ulasan ${app} Anda`,
    coldEmail: ({ app, quote }) => {
      const q = quote ? `\n\nAnda menulis: "${quote}"` : '';
      return `Halo,

Saya membaca ulasan Anda tentang ${app} — sepertinya menjaga harga tetap sinkron lebih merepotkan daripada seharusnya.${q}

Satu pertanyaan singkat, dan jujur cuma ini saja: apakah Anda memasukkan harga supplier ke Shopify secara manual? Kira-kira berapa lama waktunya setiap minggu?

Bukan promosi — saya hanya ingin memahami bagaimana pemilik toko menangani hal ini.

Hughez

(Tidak relevan? Balas saja STOP dan saya tidak akan menulis lagi.)`;
    },
    replyLink: url => `Terima kasih sudah membalas — saya sangat menghargainya.

Kalau Anda ingin mencobanya, ini MarginSync:
  ${url}
Masuk dengan toko Shopify Anda dan sinkronisasi harga supplier pertama hanya butuh sekitar dua menit. Ada pertanyaan, balas saja di sini.

Hughez`,
    optoutAck: () => `Tidak masalah — Anda sudah saya keluarkan dari daftar dan tidak akan saya hubungi lagi.\n\nHughez`,
    notInterestedAck: () => `Sangat dimengerti — terima kasih atas balasannya, dan sukses untuk tokonya.\n\nHughez`,
    followUp: () => `Halo,

Sekadar menindaklanjuti kalau-kalau pesan saya sebelumnya terlewat — tidak apa-apa kalau memang kurang cocok.

Tapi saya tetap penasaran: apakah Anda memasukkan harga supplier ke Shopify secara manual, dan berapa lama waktunya tiap minggu?

Hughez`,
    formOnboarding: (name, url) => `Halo ${name},

Terima kasih sudah mendaftar MarginSync — senang Anda bergabung.

Ini tautan Anda:
  ${url}
Masuk dengan toko Shopify Anda dan Anda bisa langsung menjalankan sinkronisasi harga supplier pertama (sekitar dua menit). Kalau ada yang janggal, balas saja di sini.

Hughez`,
    igOpener: (name, product, country) => `Halo ${name}! Tidak sengaja menemukan toko ${product} Anda${loc('di', country)} — koleksinya keren.`,
    igQuestion: () => `Sekadar bertanya — saat supplier mengirim daftar harga terbaru, apakah Anda memasukkannya ke Shopify secara manual? Saya selalu penasaran bagaimana pemilik toko menanganinya.`,
    igPitch: () => `Masuk akal. Saya membuat alat kecil bernama MarginSync — Anda unggah CSV supplier dan ia memetakan harga baru ke produk Shopify Anda, dengan pratinjau lengkap sebelum apa pun tayang. Gratis selama masa beta. Mau coba lihat?`,
    igLink: url => `Ini tautannya — sekitar lima menit untuk menghubungkan: ${url}`,
  },

  // ── Español ──────────────────────────────────────────────────────────────────
  es: {
    subject: app => `una pregunta rápida tras tu reseña de ${app}`,
    coldEmail: ({ app, quote }) => {
      const q = quote ? `\n\nEscribiste: "${quote}"` : '';
      return `Hola,

Leí tu reseña sobre ${app} — parece que mantener los precios sincronizados ha sido más complicado de lo que debería.${q}

Una pregunta rápida, y de verdad es solo eso: ¿actualizas a mano los precios de tus proveedores en Shopify? ¿Cuánto tiempo te lleva más o menos cada semana?

No es una venta — solo intento entender cómo lo gestionan los dueños de tiendas.

Hughez

(¿No es relevante? Responde STOP y no volveré a escribir.)`;
    },
    replyLink: url => `Gracias por responder — te lo agradezco de verdad.

Si quieres probarlo, aquí tienes MarginSync:
  ${url}
Inicia sesión con tu tienda de Shopify y tu primera sincronización de precios lleva unos dos minutos. Cualquier duda, responde aquí.

Hughez`,
    optoutAck: () => `Sin problema — te he quitado de la lista y no volveré a escribir.\n\nHughez`,
    notInterestedAck: () => `Totalmente comprensible — gracias por responder y mucha suerte con la tienda.\n\nHughez`,
    followUp: () => `Hola,

Solo doy seguimiento por si mi mensaje anterior quedó enterrado — sin problema si no es para ti.

Pero sigo con la curiosidad: ¿actualizas a mano los precios de proveedores en Shopify y cuánto tiempo te lleva cada semana?

Hughez`,
    formOnboarding: (name, url) => `Hola ${name},

Gracias por registrarte en MarginSync — me alegra tenerte.

Aquí tienes tu enlace:
  ${url}
Inicia sesión con tu tienda de Shopify y podrás hacer tu primera sincronización de precios enseguida (unos dos minutos). Si algo se ve raro, responde aquí.

Hughez`,
    igOpener: (name, product, country) => `¡Hola ${name}! Me encontré con tu tienda de ${product}${loc('en', country)} — muy buena selección.`,
    igQuestion: () => `Una pregunta — cuando tus proveedores envían listas de precios actualizadas, ¿las cargas a mano en Shopify? Siempre me da curiosidad cómo lo manejan los dueños de tiendas.`,
    igPitch: () => `Tiene sentido. Hice una herramienta llamada MarginSync — subes el CSV del proveedor y mapea los nuevos precios a tus productos de Shopify, con una vista previa completa antes de publicar nada. Gratis mientras está en beta. ¿Le echas un vistazo?`,
    igLink: url => `Aquí está el enlace — unos cinco minutos para conectarlo: ${url}`,
  },

  // ── Français ─────────────────────────────────────────────────────────────────
  fr: {
    subject: app => `une question rapide après votre avis sur ${app}`,
    coldEmail: ({ app, quote }) => {
      const q = quote ? `\n\nVous avez écrit : "${quote}"` : '';
      return `Bonjour,

J'ai lu votre avis sur ${app} — on dirait que garder les prix synchronisés vous a donné plus de fil à retordre que prévu.${q}

Une question rapide, et ce n'est vraiment que ça : mettez-vous à jour les prix de vos fournisseurs dans Shopify à la main ? Combien de temps cela vous prend-il environ chaque semaine ?

Ce n'est pas un argumentaire — j'essaie juste de comprendre comment les commerçants gèrent ça.

Hughez

(Pas pertinent ? Répondez STOP et je ne réécrirai pas.)`;
    },
    replyLink: url => `Merci de votre réponse — je l'apprécie vraiment.

Si vous voulez l'essayer, voici MarginSync :
  ${url}
Connectez-vous avec votre boutique Shopify et votre première synchronisation de prix prend environ deux minutes. Une question, répondez ici.

Hughez`,
    optoutAck: () => `Aucun souci — je vous ai retiré de la liste et ne vous réécrirai pas.\n\nHughez`,
    notInterestedAck: () => `Tout à fait compréhensible — merci pour votre réponse et bonne continuation avec la boutique.\n\nHughez`,
    followUp: () => `Bonjour,

Je reviens vers vous au cas où mon dernier message serait passé inaperçu — pas de souci si ce n'est pas pour vous.

Je reste curieux malgré tout : mettez-vous à jour les prix fournisseurs dans Shopify à la main, et combien de temps cela prend-il chaque semaine ?

Hughez`,
    formOnboarding: (name, url) => `Bonjour ${name},

Merci de vous être inscrit à MarginSync — ravi de vous compter parmi nous.

Voici votre lien :
  ${url}
Connectez-vous avec votre boutique Shopify et vous pourrez lancer votre première synchronisation de prix tout de suite (environ deux minutes). Si quelque chose cloche, répondez ici.

Hughez`,
    igOpener: (name, product, country) => `Bonjour ${name} ! Je suis tombé sur votre boutique de ${product}${loc('en', country)} — très belle sélection.`,
    igQuestion: () => `Petite question — quand vos fournisseurs envoient des listes de prix mises à jour, vous les saisissez à la main dans Shopify ? Je suis toujours curieux de savoir comment les commerçants gèrent ça.`,
    igPitch: () => `Logique. J'ai créé un petit outil, MarginSync — vous importez le CSV du fournisseur et il associe les nouveaux prix à vos produits Shopify, avec un aperçu complet avant toute mise en ligne. Gratuit pendant la bêta. Ça vous tente d'y jeter un œil ?`,
    igLink: url => `Voici le lien — environ cinq minutes pour le connecter : ${url}`,
  },

  // ── Deutsch ──────────────────────────────────────────────────────────────────
  de: {
    subject: app => `kurze Frage nach Ihrer ${app}-Bewertung`,
    coldEmail: ({ app, quote }) => {
      const q = quote ? `\n\nSie schrieben: "${quote}"` : '';
      return `Hallo,

ich habe Ihre ${app}-Bewertung gelesen — es klingt, als wäre das Synchronhalten der Preise mühsamer als es sein müsste.${q}

Eine kurze Frage, und mehr ist es ehrlich gesagt nicht: Pflegen Sie Ihre Lieferantenpreise von Hand in Shopify ein? Und wie lange dauert das ungefähr pro Woche?

Kein Verkaufsgespräch — ich möchte nur verstehen, wie Händler das wirklich handhaben.

Hughez

(Nicht relevant? Antworten Sie einfach mit STOP und ich schreibe nicht wieder.)`;
    },
    replyLink: url => `Danke für Ihre Antwort — das weiß ich zu schätzen.

Wenn Sie es ausprobieren möchten, hier ist MarginSync:
  ${url}
Melden Sie sich mit Ihrem Shopify-Shop an; Ihre erste Lieferantenpreis-Synchronisierung dauert etwa zwei Minuten. Bei Fragen antworten Sie einfach hier.

Hughez`,
    optoutAck: () => `Kein Problem — ich habe Sie von der Liste genommen und schreibe nicht wieder.\n\nHughez`,
    notInterestedAck: () => `Völlig verständlich — danke für die Antwort und viel Erfolg mit dem Shop.\n\nHughez`,
    followUp: () => `Hallo,

ich melde mich nur kurz, falls meine letzte Nachricht untergegangen ist — kein Problem, wenn es nichts für Sie ist.

Mich interessiert es trotzdem: Pflegen Sie Lieferantenpreise von Hand in Shopify ein, und wie lange dauert das pro Woche?

Hughez`,
    formOnboarding: (name, url) => `Hallo ${name},

danke, dass Sie sich für MarginSync angemeldet haben — schön, dass Sie dabei sind.

Hier ist Ihr Link:
  ${url}
Melden Sie sich mit Ihrem Shopify-Shop an und Sie können sofort Ihre erste Lieferantenpreis-Synchronisierung starten (etwa zwei Minuten). Falls etwas nicht stimmt, antworten Sie einfach hier.

Hughez`,
    igOpener: (name, product, country) => `Hallo ${name}! Ich bin auf Ihren ${product}-Shop${loc('in', country)} gestoßen — wirklich schöne Auswahl.`,
    igQuestion: () => `Kurze Frage — wenn Ihre Lieferanten aktualisierte Preislisten schicken, pflegen Sie die von Hand in Shopify ein? Mich interessiert immer, wie Händler das lösen.`,
    igPitch: () => `Verständlich. Ich habe ein kleines Tool gebaut, MarginSync — Sie laden die Lieferanten-CSV hoch und es überträgt die neuen Preise auf Ihre Shopify-Produkte, mit vollständiger Vorschau, bevor irgendetwas live geht. Während der Beta kostenlos. Lust, mal reinzuschauen?`,
    igLink: url => `Hier ist der Link — etwa fünf Minuten zum Verbinden: ${url}`,
  },

  // ── Português ────────────────────────────────────────────────────────────────
  pt: {
    subject: app => `uma pergunta rápida após a sua avaliação de ${app}`,
    coldEmail: ({ app, quote }) => {
      const q = quote ? `\n\nVocê escreveu: "${quote}"` : '';
      return `Olá,

Li a sua avaliação sobre ${app} — parece que manter os preços sincronizados tem dado mais trabalho do que devia.${q}

Uma pergunta rápida, e é só isso mesmo: você atualiza os preços dos seus fornecedores no Shopify manualmente? E quanto tempo isso leva por semana, mais ou menos?

Não é uma proposta de venda — só quero entender como os lojistas lidam com isso.

Hughez

(Não é relevante? Responda STOP e não escreverei novamente.)`;
    },
    replyLink: url => `Obrigado por responder — agradeço de verdade.

Se quiser experimentar, aqui está o MarginSync:
  ${url}
Entre com a sua loja Shopify e a sua primeira sincronização de preços leva cerca de dois minutos. Qualquer dúvida, responda aqui.

Hughez`,
    optoutAck: () => `Sem problema — removi você da lista e não escreverei novamente.\n\nHughez`,
    notInterestedAck: () => `Totalmente compreensível — obrigado pela resposta e muito sucesso com a loja.\n\nHughez`,
    followUp: () => `Olá,

Só retomando caso a minha última mensagem tenha se perdido — tudo bem se não for para você.

Mas continuo curioso: você atualiza os preços de fornecedores no Shopify manualmente, e quanto tempo leva por semana?

Hughez`,
    formOnboarding: (name, url) => `Olá ${name},

Obrigado por se inscrever no MarginSync — que bom ter você.

Aqui está o seu link:
  ${url}
Entre com a sua loja Shopify e já pode fazer a sua primeira sincronização de preços (cerca de dois minutos). Se algo parecer estranho, responda aqui.

Hughez`,
    igOpener: (name, product, country) => `Olá ${name}! Encontrei a sua loja de ${product}${loc('em', country)} — seleção muito boa.`,
    igQuestion: () => `Uma pergunta — quando os seus fornecedores enviam listas de preços atualizadas, você as insere manualmente no Shopify? Tenho sempre curiosidade de como os lojistas lidam com isso.`,
    igPitch: () => `Faz sentido. Criei uma ferramenta chamada MarginSync — você envia o CSV do fornecedor e ela mapeia os novos preços para os seus produtos no Shopify, com uma prévia completa antes de qualquer coisa ir ao ar. Gratuita enquanto está em beta. Quer dar uma olhada?`,
    igLink: url => `Aqui está o link — cerca de cinco minutos para conectar: ${url}`,
  },
};

// Return the message pack for a reviewer's country (English fallback).
function forCountry(country) {
  return MESSAGES[detectLanguage(country)] || MESSAGES.en;
}

module.exports = { detectLanguage, forCountry, MESSAGES };
