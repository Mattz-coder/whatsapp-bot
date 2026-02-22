const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const fs = require("fs")
const QRCode = require("qrcode")

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
        const { connection, qr, lastDisconnect } = update

        if (qr) {
            console.log("\n📲 Escaneie o QR Code abaixo:\n")
            const qrImage = await QRCode.toString(qr, { type: "terminal", small: true })
            console.log(qrImage)
        }

        if (connection === "open") {
            console.log("✅ BOT ONLINE 24H 🚀")
        }

        if (connection === "close") {
            console.log("⚠️ Conexão fechada. Reconectando...")
            startBot()
        }
    })

    // ===============================
    // 🎧 OUVIR MENSAGENS
    // ===============================

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

            // ===============================
            // 🤖 COMANDO MENU
            // ===============================
            if (command === "!menu") {
                await sock.sendMessage(from, {
                    text:
`🤖 *MENU PRINCIPAL*

1️⃣ !ping
2️⃣ !info

Digite um comando.`
                })
            }

            // ===============================
            // 🏓 PING
            // ===============================
            else if (command === "!ping") {
                await sock.sendMessage(from, { text: "🏓 Pong!" })
            }

            // ===============================
            // ℹ️ INFO
            // ===============================
            else if (command === "!info") {
                await sock.sendMessage(from, {
                    text: "🤖 Bot ativo no Railway\n⚡ Online 24h\n🚀 Baileys funcionando"
                })
            }

        } catch (err) {
            console.log("❌ Erro ao processar mensagem:", err)
        }
    })
}

startBot()

// Anti-crash Railway
process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)
