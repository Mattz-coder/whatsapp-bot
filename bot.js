const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const fs = require("fs")
const QRCode = require("qrcode")

const dono = "55S41988972311@s.whatsapp.net"

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
            console.log("\n📱 GERANDO QR EM IMAGEM...\n")

            const qrImage = await QRCode.toDataURL(qr)

            console.log("👇 COPIE ESTE LINK NO NAVEGADOR 👇\n")
            console.log(qrImage)
            console.log("\n----------------------------------\n")
        }

        if (connection === "open") {
            console.log("🤖 BOT ONLINE 24H")
        }

        if (connection === "close") {
            console.log("🔄 Reconectando...")
            startBot()
        }
    })
}

startBot()

setInterval(() => {}, 1000)
