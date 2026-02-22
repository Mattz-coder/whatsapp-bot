const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const fs = require("fs")
const path = require("path")

const jogosForca = {}
const palavras = ["javascript", "railway", "whatsapp", "programacao", "nodejs"]

async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
        const { connection, qr } = update

        if (qr) {
            const qrBase64 = await QRCode.toDataURL(qr)
            console.log("\n🔗 Abra no navegador:\n")
            console.log(qrBase64)
        }

        if (connection === "open") {
            console.log("✅ BOT ONLINE 🚀")
        }

        if (connection === "close") {
            console.log("⚠️ Reconectando...")
            startBot()
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message) return

            const from = msg.key.remoteJid
            const sender = msg.key.participant || msg.key.remoteJid

            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                ""

            const command = text.toLowerCase().trim()

            // ===============================
            // MENU
            // ===============================
            if (command === "!menu") {
                await sock.sendMessage(from, {
                    text:
`🤖 *MENU*

🎮 Jogos:
!forca
!roleta

🖼 Figurinhas:
Envie uma imagem com o comando:
!sticker`
                })
            }

            // ===============================
            // FIGURINHA
            // ===============================
            if (command === "!sticker" && msg.message.imageMessage) {

                const stream = await downloadContentFromMessage(
                    msg.message.imageMessage,
                    "image"
                )

                let buffer = Buffer.from([])
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk])
                }

                await sock.sendMessage(from, {
                    sticker: buffer
                })

                await sock.sendMessage(from, { text: "🖼 Figurinha criada!" })
            }

            // ===============================
            // JOGO DA FORCA
            // ===============================
            if (command === "!forca") {

                const palavra = palavras[Math.floor(Math.random() * palavras.length)]
                jogosForca[sender] = {
                    palavra,
                    letras: [],
                    erros: 0
                }

                await sock.sendMessage(from, {
                    text: `🎮 *JOGO DA FORCA*\n\nPalavra: ${"_ ".repeat(palavra.length)}\n\nDigite uma letra.`
                })
            }

            if (jogosForca[sender] && command.length === 1) {

                const jogo = jogosForca[sender]
                const letra = command

                if (!jogo.palavra.includes(letra)) {
                    jogo.erros++
                } else {
                    jogo.letras.push(letra)
                }

                let exibicao = ""
                for (let l of jogo.palavra) {
                    exibicao += jogo.letras.includes(l) ? l + " " : "_ "
                }

                if (!exibicao.includes("_")) {
                    await sock.sendMessage(from, { text: `🏆 Você venceu!\nPalavra: ${jogo.palavra}` })
                    delete jogosForca[sender]
                    return
                }

                if (jogo.erros >= 6) {
                    await sock.sendMessage(from, { text: `💀 Você perdeu!\nPalavra era: ${jogo.palavra}` })
                    delete jogosForca[sender]
                    return
                }

                await sock.sendMessage(from, {
                    text: `🎮 Forca\n\n${exibicao}\nErros: ${jogo.erros}/6`
                })
            }

            // ===============================
            // ROLETA
            // ===============================
            if (command === "!roleta") {

                const numero = Math.floor(Math.random() * 6) + 1

                if (numero === 1) {
                    await sock.sendMessage(from, { text: "💀 BANG! Você perdeu!" })
                } else {
                    await sock.sendMessage(from, { text: "😅 Clique vazio... Você sobreviveu!" })
                }
            }

        } catch (err) {
            console.log("Erro:", err)
        }
    })
}

startBot()

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)
