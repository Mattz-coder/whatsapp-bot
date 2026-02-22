const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const P = require("pino")
const fs = require("fs")

const dono = "554188972311@s.whatsapp.net"

let antilink = false
let forca = null

const saldoFile = "./saldo.json"

function carregarSaldo() {
    if (!fs.existsSync(saldoFile)) {
        fs.writeFileSync(saldoFile, JSON.stringify({}))
    }
    return JSON.parse(fs.readFileSync(saldoFile))
}

function salvarSaldo(data) {
    fs.writeFileSync(saldoFile, JSON.stringify(data, null, 2))
}

let saldo = carregarSaldo()

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: true
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", ({ connection }) => {
        if (connection === "open") {
            console.log("🤖 BOT ONLINE")
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return

        const from = msg.key.remoteJid
        const sender = msg.key.participant || from
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""

        if (antilink && text.includes("chat.whatsapp.com")) {
            await sock.groupParticipantsUpdate(from, [sender], "remove")
            return
        }

        if (!text.startsWith("!")) return

        const args = text.slice(1).trim().split(" ")
        const command = args.shift().toLowerCase()

        if (command === "menu") {
            await sock.sendMessage(from, {
                text: `🤖 MENU

🎮 Jogos
!forca iniciar
!saldo
!apostar valor

🛡️ Moderação
!ban @membro
!kick @membro
!antilink on/off`
            })
        }

        if (command === "saldo") {
            if (!saldo[sender]) saldo[sender] = 100
            salvarSaldo(saldo)
            await sock.sendMessage(from, { text: `💰 Saldo: ${saldo[sender]}` })
        }

        if (command === "apostar") {
            if (!saldo[sender]) saldo[sender] = 100
            const valor = parseInt(args[0])
            if (!valor || valor <= 0) return

            const ganhou = Math.random() < 0.5
            if (ganhou) saldo[sender] += valor
            else saldo[sender] -= valor

            salvarSaldo(saldo)

            await sock.sendMessage(from, {
                text: ganhou
                    ? `🎉 Ganhou +${valor}\nSaldo: ${saldo[sender]}`
                    : `💀 Perdeu -${valor}\nSaldo: ${saldo[sender]}`
            })
        }
    })
}

startBot()

// 🔥 IMPEDIR RAILWAY DE FINALIZAR PROCESSO
setInterval(() => {}, 1000)
