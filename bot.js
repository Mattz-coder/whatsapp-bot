const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const fs = require("fs")

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
            console.log("\n📲 Gerando QR Code em imagem...")

            // Gera QR em base64
            const qrBase64 = await QRCode.toDataURL(qr)

            console.log("\n🔗 COPIE O LINK ABAIXO E ABRA NO NAVEGADOR:\n")
            console.log(qrBase64)
            console.log("\n")
        }

        if (connection === "open") {
            console.log("✅ BOT ONLINE 🚀")
        }

        if (connection === "close") {
            console.log("⚠️ Conexão fechada. Reconectando...")
            startBot()
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0]
            if (!msg.message) return

            const from = msg.key.remoteJid
            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                ""

            const command = text.toLowerCase().trim()

            console.log("📩 Mensagem:", command)

            if (command === "!menu") {
                await sock.sendMessage(from, {
                    text: `🤖 *MENU*

1️⃣ !ping
2️⃣ !info`
                })
            }

            else if (command === "!ping") {
                await sock.sendMessage(from, { text: "🏓 Pong!" })
            }

            else if (command === "!info") {
                await sock.sendMessage(from, {
                    text: "Bot rodando no Railway 🚀"
                })
            }

        } catch (err) {
            console.log("Erro:", err)
        }
    })
}

startBot()

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)
