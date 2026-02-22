// ================= IMPORTS =================
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const fs = require("fs")
const XLSX = require("xlsx")
const PDFDocument = require("pdfkit")

// ================= CONFIG =================
const OWNER = "5541988972311@s.whatsapp.net"
let prof = "mattheus"
let escola = "anesio"

// ================= UTIL =================
function dir(path) {
    if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

function caminho(tipo) {
    const base = `dados/${prof}/${escola}`
    dir(base)
    return `${base}/${tipo}.xlsx`
}

function ler(file) {
    if (!fs.existsSync(file)) {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet([])
        XLSX.utils.book_append_sheet(wb, ws, "Dados")
        XLSX.writeFile(wb, file)
    }
    const wb = XLSX.readFile(file)
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
}

function salvar(file, dados) {
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Dados")
    XLSX.writeFile(wb, file)
}

function hoje() {
    return new Date().toLocaleDateString()
}

function getRegistroDia(dados, serie, aluno) {
    return dados.find(d => d.Data === hoje() && d.Serie === serie && d.Aluno === aluno)
}

// ================= PDF DIA =================
function gerarPDFDia(acad, disc) {
    const dadosA = ler(acad).filter(d => d.Data === hoje())
    const dadosD = ler(disc).filter(d => d.Data === hoje())

    const path = `pdf-dia-${Date.now()}.pdf`
    const doc = new PDFDocument()
    doc.pipe(fs.createWriteStream(path))

    doc.fontSize(14).text(`Professor: ${prof}`)
    doc.text(`Escola: ${escola}`)
    doc.text(`Data: ${hoje()}`)
    doc.moveDown()

    dadosA.forEach(d => {
        doc.text(`${d.Serie} - ${d.Aluno}`)
        doc.text(`Presença: ${d.Presenca} | Tarefa: ${d.Tarefa}`)
        if (d.Conteudo) doc.text(`Conteúdo: ${d.Conteudo}`)
        doc.moveDown()
    })

    if (dadosD.length) {
        doc.addPage()
        doc.text("REGISTROS DISCIPLINARES")
        doc.moveDown()
        dadosD.forEach(d => {
            doc.text(`${d.Serie} ${d.Aluno} - ${d.Tipo}`)
            doc.text(d.Descricao)
            doc.moveDown()
        })
    }

    doc.end()
    return path
}

// ================= PDF ALUNO =================
function gerarPDFAluno(acad, disc, serie, aluno) {
    const dadosA = ler(acad).filter(d => d.Serie === serie && d.Aluno === aluno)
    const dadosD = ler(disc).filter(d => d.Serie === serie && d.Aluno === aluno)

    const path = `pdf-${aluno}-${Date.now()}.pdf`
    const doc = new PDFDocument()
    doc.pipe(fs.createWriteStream(path))

    doc.fontSize(14).text(`Aluno: ${aluno}`)
    doc.text(`Série: ${serie}`)
    doc.text(`Professor: ${prof}`)
    doc.text(`Escola: ${escola}`)
    doc.moveDown()

    let pres = 0
    dadosA.forEach(d => {
        doc.text(`${d.Data} | Presença: ${d.Presenca} | Tarefa: ${d.Tarefa}`)
        if (d.Conteudo) doc.text(`Conteúdo: ${d.Conteudo}`)
        doc.moveDown()
        if (d.Presenca === "✔") pres++
    })

    const freq = dadosA.length ? ((pres / dadosA.length) * 100).toFixed(1) : 0
    doc.text(`Frequência: ${freq}%`)
    doc.moveDown()

    if (dadosD.length) {
        doc.addPage()
        doc.text("REGISTRO DISCIPLINAR")
        dadosD.forEach(d => {
            doc.text(`${d.Data} - ${d.Tipo}`)
            doc.text(d.Descricao)
            doc.moveDown()
        })
    }

    doc.end()
    return path
}

// ================= BOT =================
async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async ({ connection, qr }) => {
        if (qr) console.log(await QRCode.toDataURL(qr))
        if (connection === "open") console.log("Sistema Escolar V2 ONLINE")
        if (connection === "close") startBot()
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        console.log("MSG RAW:", JSON.stringify(messages, null, 2))

        const msg = messages[0]
        if (!msg.message) return
    const sender = msg.key.participant || msg.key.remoteJid

if (!sender.includes("5541988972311")) return

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ""

        if (!text.startsWith("!")) return

        const p = text.split(" ")

        if (p[0] === "!prof") {
            prof = p[1]
            return sock.sendMessage(msg.key.remoteJid, { text: `Professor ativo: ${prof}` })
        }

        if (p[0] === "!escola") {
            escola = p[1]
            return sock.sendMessage(msg.key.remoteJid, { text: `Escola ativa: ${escola}` })
        }

        const acad = caminho("academico")
        const disc = caminho("disciplinar")

        // ===== PRESENÇA / TAREFA MESMA LINHA =====
        if (["!presente","!falta","!fez","!naofez"].includes(p[0])) {

            const serie = p[1]
            const aluno = p.slice(2).join(" ")
            const dados = ler(acad)

            let reg = getRegistroDia(dados, serie, aluno)
            if (!reg) {
                reg = { Data: hoje(), Serie: serie, Aluno: aluno, Presenca: "", Tarefa: "", Conteudo: "" }
                dados.push(reg)
            }

            if (p[0] === "!presente") reg.Presenca = "✔"
            if (p[0] === "!falta") reg.Presenca = "❌"
            if (p[0] === "!fez") reg.Tarefa = "✔"
            if (p[0] === "!naofez") reg.Tarefa = "❌"

            salvar(acad, dados)
            return sock.sendMessage(msg.key.remoteJid, { text: "Registro atualizado" })
        }

        if (p[0] === "!conteudo") {
            const dados = ler(acad)
            dados.push({ Data: hoje(), Serie: "", Aluno: "", Presenca: "", Tarefa: "", Conteudo: p.slice(1).join(" ") })
            salvar(acad, dados)
            return sock.sendMessage(msg.key.remoteJid, { text: "Conteúdo registrado" })
        }

        if (p[0] === "!disciplina") {
            const dados = ler(disc)
            dados.push({
                Data: hoje(),
                Serie: p[1],
                Aluno: p[2],
                Tipo: p[3],
                Descricao: p.slice(4).join(" ")
            })
            salvar(disc, dados)
            return sock.sendMessage(msg.key.remoteJid, { text: "Registro disciplinar salvo" })
        }

        if (p[0] === "!pdfdia") {
            const path = gerarPDFDia(acad, disc)
            return sock.sendMessage(msg.key.remoteJid, {
                document: fs.readFileSync(path),
                mimetype: "application/pdf",
                fileName: path
            })
        }

        if (p[0] === "!pdfaluno") {
            const path = gerarPDFAluno(acad, disc, p[1], p.slice(2).join(" "))
            return sock.sendMessage(msg.key.remoteJid, {
                document: fs.readFileSync(path),
                mimetype: "application/pdf",
                fileName: path
            })
        }

        if (p[0] === "!backup") {
            return sock.sendMessage(msg.key.remoteJid, {
                document: fs.readFileSync(acad),
                mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName: "academico.xlsx"
            })
        }

    })
}

startBot()
