const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")

async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async ({ connection, qr }) => {
        if (qr) {
            const qrImage = await QRCode.toDataURL(qr)
            console.log(qrImage)
        }

        if (connection === "open") {
            console.log("BOT ONLINE")
        }

        if (connection === "close") {
            startBot()
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0]
        if (!msg.message) return
        if (msg.message.protocolMessage) return

        const jid = msg.key.remoteJid
        const m = msg.message

        const text =
            m.conversation ||
            m.extendedTextMessage?.text ||
            m.ephemeralMessage?.message?.conversation ||
            m.ephemeralMessage?.message?.extendedTextMessage?.text ||
            ""

        if (!text) return

        console.log("Recebido:", text)

        if (text === "!teste") {
            await sock.sendMessage(jid, { text: "OK ✅" })
        }

    })

}

startBot()
