import * as Sentry from "@sentry/browser"

class KFWProxy {
    constructor(base = "https://kfwproxy.geek1011.net") {
        this.base = base
    }

    async latestVersion(id, affiliate = "kobo") {
        let version = "0.0"
        if (id == "00000000-0000-0000-0000-000000000381")
            version = "4.7.10364" // required to receive the next update
        return await this.UpgradeCheck(id, affiliate, version)
    }

    async UpgradeCheck(id, affiliate = "kobo", version = "0.0", serial = "N0") {
        return await this.KoboAPI(`1.0/UpgradeCheck/Device/${id}/${affiliate}/${version}/${serial}`, true, KFWProxy.transformUpgrade)
    }

    static transformUpgrade(obj) {
        obj.UpgradeVersion = KFWProxy.#transformUpgradeVersion(obj.UpgradeURL)
        obj.UpgradeDate    = KFWProxy.#transformUpgradeDate(obj.UpgradeURL, obj.UpgradeVersion)
        if (false) // debug
            if (Math.random() > .5)
                obj.UpgradeVersion = "1.2.3"
        return obj
    }

    static #transformUpgradeVersion(url) {
        // fallback
        if (!url)
            return "0.0"

        // overrides
        url = url.split("?")[0]
        if (url.endsWith("/kobo7/April2018/kobo-update-4.8.zip"))             return "4.8.10956"
        if (url.endsWith("/kobo7/May2018/kobo-update-4.8.zip"))               return "4.8.11090"
        if (url.endsWith("/kobo4/May2018/kobo-update-4.9.11311.zip"))         return "4.9.11314"
        if (url.endsWith("/kobo5/May2018/kobo-update-4.9.11311.zip"))         return "4.9.11314"
        if (url.endsWith("/kobo6/Aug2018/kobo-update-4.10.zip"))              return "4.10.11591"
        if (url.endsWith("/kobo7/Aug2018/kobo-update-4.10.zip"))              return "4.10.11591"

        // filename
        const m = url.match(/\/kobo-update-([0-9.]+(?:-s)?)(?:-TF[0-9]+|-TouchFW-[0-9]+)?\.zip/)
        if (!m || m.length != 2)
            throw new Error(`Failed to extract version from "${url}"`)
        return m[1]
    }

    static #transformUpgradeDate(url, version) {
        // fallback
        if (!url || !version || version == "0.0")
            return "Unknown"

        // overrides
        switch (version) {
            case "3.4.1":      return "May 2014"
            case "4.6.9960":   return "October 2017"
            case "4.6.10075":  return "November 2017"
            case "4.9.11311":  return "June 2018"
            case "4.9.11314":  return "June 2018"
            case "4.28.17623": return "June 2021" // it was indeed built in May as it is in the URL, but we don't want to confuse people
        }
    
        // date folder
        const m = url.match(/\/firmwares\/kobo[0-9]\/(.+?)\//)
        if (!m || m.length != 2)
            throw new Error(`Failed to extract date from "${url}" and "${version}"`)

        // month expansion
        let [month, year] = m[1].replace(/([0-9]+)/, " $1").split(" ")
        switch ((month = month.charAt(0).toUpperCase() + month.slice(1))) {
            case "Jan":      month = "January"; break
            case "Feb":      month = "February"; break
            case "Mar":      month = "March"; break
            case "Apr":      month = "April"; break
            case "Jun":      month = "June"; break
            case "Jul":      month = "July"; break
            case "Aug":      month = "August"; break
            case "Sep":      month = "September"; break
            case "Sept":     month = "September"; break
            case "Oct":      month = "October"; break
            case "Nov":      month = "November"; break
            case "Dec":      month = "December"; break
            case "Rakuten-": month = "Unknown"; break
        }
        return [month, year].join(" ").trim()
    }

    // -1[a<b] 0[a=b] 1[a>b]
    static versionCompare(a, b) {
        // fallback
        if (!a) return -1;
        if (!b) return 1;

        // April 2019 -s version suffix.
        if (a.endsWith("-s") && b == a.substring(0, a.length - 2)) return 1
        if (b.endsWith("-s") && a == b.substring(0, b.length - 2)) return -1
    
        // version parts
        const as = a.split(".").map(x => parseInt(x, 10))
        const bs = b.split(".").map(x => parseInt(x, 10))
        for (let i = 0; i < Math.max(as.length, bs.length); i++) {
            if (as[i] == null) return bs[i] == 0 ? 0 : -1
            if (bs[i] == null) return as[i] == 0 ? 0 : 1
            if (as[i] < bs[i]) return -1
            if (as[i] > bs[i]) return 1
        }
        return 0
    }

    async ReleaseNotes(n = 1) {
        if (typeof n === "string") {
            const m = n.match(/\/1\.0\/ReleaseNotes\/([0-9]+)/)
            if (!m || m.length != 2)
                throw new Error(`Failed to extract release note number from "${n}"`)
            n = m[1]
        }
        return await this.KoboAPI(`1.0/ReleaseNotes/${n}`, false, KFWProxy.transformNotes)
    }

    static transformNotes(html) {
        const css = `p{margin:0}`
        try {
            const doc = new DOMParser().parseFromString(html, "text/html")
            doc.head.appendChild(doc.createElement("style")).textContent = css
            return doc.documentElement.innerHTML
        } catch (ex) {
            // this happens on the Kobo Web Browser for some reason
            console.warn(`tranform notes failed ${ex}, falling back to innerHTML method`)
            const doc = document.createElement("div")
            doc.innerHTML = html
            return `<html><head><title></title><style>${css}</style></head><body>${doc.innerHTML}</body></html>`
        }
    }

    async KoboAPI(path, json = false, transform = null) {
        return await this.#request(`${this.base}/api.kobobooks.com/${path}`, json, transform)
    }

    // request batching

    #pending = null
    #PendingRequest = class {
        constructor(url, json = false, transform = null) {
            this.url       = url
            this.transform = transform
            this.json      = json
            this.promise   = new Promise((a, b) => {
                this.resolve = a
                this.reject  = b
            })
        }
    }

    batch() {
        if (!this.#pending)
            this.#pending = []
    }

    endBatch() {
        if (this.#pending) {
            this.#doBatch(...this.#pending)
            this.#pending = null
        }
    }

    async #request(url, json = false, transform = null) {
        const req = new this.#PendingRequest(url, json, transform)
        if (this.#pending && url.startsWith(`${this.base}/api.kobobooks.com/`)) {
            this.#pending.push(req)
        } else {
            this.#do(req)
        }
        return req.promise
    }

    async #do(req) {
        const xhr = new XMLHttpRequest()
        xhr.addEventListener("load", ev => this.#doResponse(req, xhr.responseText, xhr.status, xhr.statusText, xhr.getResponseHeader("X-KFWProxy-Request-Id")))
        xhr.addEventListener("error", ev => req.reject(new Error(`Request to "${req.url}" failed`)))
        xhr.addEventListener("abort", ev => req.reject(new Error(`Request to "${req.url}" aborted`)))
        xhr.open("GET", req.url)
        xhr.send()
        return await req.promise
    }

    async #doBatch(...req) {
        if (req.length == 0) {
            return
        }
        const xhr = new XMLHttpRequest()
        xhr.addEventListener("load", ev => {
            const requestID = xhr.getResponseHeader("X-KFWProxy-Request-Id")
            try {
                if (xhr.status != 200)
                    throw `${xhr.status} ${xhr.statusText}`
                const rsp = JSON.parse(xhr.responseText)
                if (!Array.isArray(rsp))
                    throw `response not an array`
                if (rsp.length != req.length)
                    throw `found ${rsp.length} responses, but expected ${req.length}`
                for (let i = 0; i < req.length; i++)
                    this.#doResponse(req[i], rsp[i].body, rsp[i].status, "", requestID)
            } catch (ex) {
                for (const r of req)
                    r.reject(new Error(`Batch request including "${r.url}" failed: ${ex}`))
                Sentry.captureException(new Error(`Batch request failed: ${ex}`), {
                    extra: {requestID},
                })
                return
            }
        })
        xhr.addEventListener("error", ev => req.forEach(r => r.reject(new Error(`Batch request including "${r.url}" failed`))))
        xhr.addEventListener("abort", ev => req.forEach(r => r.reject(new Error(`Batch request including "${r.url}" aborted`))))
        xhr.open("GET", `${this.base}/api.kobobooks.com?h=1&x=${req.map(r => encodeURIComponent(r.url.replace(`${this.base}/api.kobobooks.com/`, ""))).join("&x=")}`)
        xhr.send()
        return await Promise.all(req.map(r => r.promise))
    }

    #doResponse(req, body, status, statusText = "", requestID = null) {
        if (status != 200) {
            req.reject(new Error(`Request to "${req.url}" failed: ${status} ${statusText}`))
            Sentry.captureException(new Error(`Request to "${req.url}" failed: ${status} ${statusText}`), {
                extra: {requestID},
            })
            return
        }
        let obj = body
        if (req.json) {
            try {
                obj = JSON.parse(obj)
            } catch (ex) {
                req.reject(new Error(`Request to "${req.url}" failed: ${ex}`))
                return
            }
        }
        if (req.transform) {
            try {
                obj = req.transform(obj)
            } catch (ex) {
                req.reject(new Error(`Request to "${req.url}" failed: transform error: ${ex}`))
                return
            }
        }
        req.resolve(obj)
    }
}

// so we can load it deferred directly from the webpage
const KoboFirmwareOldVersionsData = window.KoboFirmwareOldVersionsData = (() => {
    let resolve, reject
    let promise = new Promise((a, b) => {
        resolve = a
        reject  = b
    })
    let timeout = window.setTimeout(() => {
        if ("KoboFirmwareOldVersionsDataRaw" in window) {
            resolve(KoboFirmwareOldVersionsDataRaw)
            console.warn("async old versions load failed, but still found the data afterwards...")
            return
        }
        reject(new Error("Failed to load old versions data: Timed out"))
        console.error("old versions load failed")
        Sentry.captureException(new Error("Failed to load old versions data: Timed out"))
    }, 10000)
    promise.resolve = data => {
        window.clearTimeout(timeout)
        resolve(data)
    }
    return promise
})()

class KoboFirmwareDB {
    #db
    constructor(db = KoboFirmwareOldVersionsData) {
        this.#db = db // hardware, id, version, date, download
    }
    #__db
    async #_db() {
        if (this.#__db)
            return this.#__db
        this.#__db = (await this.#db)
            .sort(([,aid,aversion,,], [,bid,bversion,,]) => {
                const a = KFWProxy.versionCompare(aversion, bversion)
                return a == 0 ? aid.localeCompare(bid) : a
            })
        return this.#__db
    }
    async versionsForDevice(id) {
        return (await this.#_db())
            .filter(([,did,,,]) => did == id)
            .reverse() // #_db sorts it asc, we want it desc
            .map(([,,version,date,download]) => ({version, date, download}))
    }
    async versionsByDevice() {
        let tmp = (await this.#_db())
            .reduce((acc, [,id,version,date,]) => {
                (acc[id] = acc[id] || {})[version] = date
                return acc
            }, {})
        for (const id in tmp) {
            let earliest
            for (const version in tmp[id])
                if (!earliest || KFWProxy.versionCompare(earliest, version) == 1)
                    earliest = version
            tmp[id].earliest = earliest
        }
        return tmp
    }
    async versions() {
        return Object.keys((await this.#_db())
            .reduce((acc, [,,version,,]) => {
                acc[version] = null
                return acc
            }, {}))
            .reverse() // #_db sorts it asc, we want it desc
    }
    async downloadsByVersion() {
        let tmp = []
        let cur, curv
        let devs = {}, devsh = {}
        for (const [hardware,id,version,date,download] of await this.#_db()) {
            if (curv != version) {
                if (cur)
                    tmp.push(cur)
                cur = {version, date, for: {}, download: {[hardware]: download}}
                curv = version
            }
            if (hardware in cur.download) {
                if (cur.download[hardware] != download)
                    cur.download[hardware] = "varies" // maybe make this add all by device id if needed later?
            } else {
                cur.download[hardware] = download
            }
            cur.for[id] = true
            if (!(id in devs)) {
                {devs[id] = hardware}
                (devsh[hardware] = devsh[hardware] || {})[id] = null
            }
        }
        tmp.push(cur)
        for (let i = 0; i < tmp.length; i++) {
            tmp[i].notfor = []
            for (const hardware in tmp[i].download)
                for (const id in devsh[hardware])
                    if (!(id in tmp[i].for))
                        tmp[i].notfor.push(id)
            tmp[i].for = Object.keys(tmp[i].for)
        }
        return tmp
    }
}

class KoboFirmware {
    #kfw
    #db
    #affiliates
    #devices

    get debug() {
        return {
            KFWProxy, KoboFirmwareDB, KoboFirmwareOldVersionsData, KoboFirmware,
            kfw:        this.#kfw,
            db:         this.#db,
            affiliates: this.#affiliates,
            devices:    this.#devices,
            req:        this.#req,
        }
    }

    constructor(
        kfw = new KFWProxy(),
        db = new KoboFirmwareDB(), 
        affiliates = [
            "kobo",
            "bestbuyca",
            "fnac",
            "beta",
            "rakutenbooks",
            "walmartca",
        ],
        devices = [
            ["kobo3", "00000000-0000-0000-0000-000000000310", "Kobo Touch A/B"],
            ["kobo4", "00000000-0000-0000-0000-000000000320", "Kobo Touch C"],
            ["kobo4", "00000000-0000-0000-0000-000000000340", "Kobo Mini"],
            ["kobo4", "00000000-0000-0000-0000-000000000330", "Kobo Glo"],
            ["kobo6", "00000000-0000-0000-0000-000000000371", "Kobo Glo HD"],
            ["kobo6", "00000000-0000-0000-0000-000000000372", "Kobo Touch 2.0"],
            ["kobo5", "00000000-0000-0000-0000-000000000360", "Kobo Aura"],
            ["kobo4", "00000000-0000-0000-0000-000000000350", "Kobo Aura HD"],
            ["kobo5", "00000000-0000-0000-0000-000000000370", "Kobo Aura H2O"],
            ["kobo6", "00000000-0000-0000-0000-000000000374", "Kobo Aura H2O Edition 2 v1"],
            ["kobo7", "00000000-0000-0000-0000-000000000378", "Kobo Aura H2O Edition 2 v2"],
            ["kobo6", "00000000-0000-0000-0000-000000000373", "Kobo Aura ONE"],
            ["kobo6", "00000000-0000-0000-0000-000000000381", "Kobo Aura ONE Limited Edition"],
            ["kobo6", "00000000-0000-0000-0000-000000000375", "Kobo Aura Edition 2 v1"],
            ["kobo7", "00000000-0000-0000-0000-000000000379", "Kobo Aura Edition 2 v2"],
            ["kobo7", "00000000-0000-0000-0000-000000000382", "Kobo Nia"],
            ["kobo7", "00000000-0000-0000-0000-000000000376", "Kobo Clara HD"],
            ["kobo7", "00000000-0000-0000-0000-000000000380", "Kobo Forma"],
            ["kobo7", "00000000-0000-0000-0000-000000000384", "Kobo Libra H2O"],
            ["kobo8", "00000000-0000-0000-0000-000000000387", "Kobo Elipsa"],
        ],
    ) {
        this.#kfw        = kfw
        this.#db         = db
        this.#affiliates = affiliates
        this.#devices    = []
        for (const device of devices) {
            if (!Array.isArray(device) || device.length != 3)
                throw new TypeError(`Invalid device ${JSON.stringify(device)}: incorrect length`)

            const [hardware, id, name] = device
            if (!hardware || typeof hardware !== "string" || !hardware.startsWith("kobo"))
                throw new TypeError(`Invalid device ${JSON.stringify(device)}: bad hardware`)
            if (!id || typeof id !== "string" || id.length != 36) {
                throw new TypeError(`Invalid device ${JSON.stringify(device)}: bad id`) }
            if (!name || typeof name !== "string" || name.length == 0)
                throw new TypeError(`Invalid device ${JSON.stringify(device)}: bad device`)
            this.#devices.push({hardware, id, name})
        }
        this.#load()
    }

    #req // [device][affiliate]Promise<UpgradeCheckResult>
    #load() {
        this.#req = {}
        for (const device of this.#devices) {
            this.#kfw.batch()
            this.#req[device.id] = {}
            for (const affiliate of this.#affiliates)
                this.#req[device.id][affiliate] = this.#kfw.latestVersion(device.id, affiliate) // note that a Promise's result/rejection can be used multiple times
            this.#kfw.endBatch()
        }
    }

    #ctr(link, ...x) {
        if (window.goatcounter) {
            const fn = () => {
                for (const [evt, name] of x) {
                    const ct = window.goatcounter.url({
                        event: true,
                        path: `kfw-${evt}`,
                        title: `${name}`,
                    })
                    if (!ct)
                        continue
                    navigator.sendBeacon(ct)
                }
            }
            link.addEventListener("click", fn, false)
            link.addEventListener("auxclick", fn, false)
        }
    }

    async renderLatest(table) {
        const ths = document.createDocumentFragment()
        KoboFirmware.#el(ths, "th", "Model",    ["kfw-latest__model"])
        KoboFirmware.#el(ths, "th", "Hardware", ["kfw-latest__hardware"])
        KoboFirmware.#el(ths, "th", "Version",  ["kfw-latest__version"])
        KoboFirmware.#el(ths, "th", "Date",     ["kfw-latest__date"])
        KoboFirmware.#el(ths, "th", "Links",    ["kfw-latest__links"])
        table.querySelector("thead tr").appendChild(ths)

        // load the initial data
        const trm = {}
        const trs = document.createDocumentFragment()
        for (const device of this.#devices) {
            const tr = KoboFirmware.#el(trs, "tr")
            trm[device.id] = {
                model:    KoboFirmware.#el(tr, "td", device.name,     ["kfw-latest__model"], {title: `ID: ${device.id}`}),
                hardware: KoboFirmware.#el(tr, "td", device.hardware, ["kfw-latest__hardware"]),
                version:  KoboFirmware.#el(tr, "td", "Loading",       ["kfw-latest__version"]),
                date:     KoboFirmware.#el(tr, "td", null,            ["kfw-latest__date"]),
                linksw:   KoboFirmware.#el(tr, "td", null,            ["kfw-latest__links"]),
            }
            const linksw1 = KoboFirmware.#el(trm[device.id].linksw, "span", null, [], {style: "display: inline-block; vertical-align: top;"}) // to control wrapping
            const linksw2 = KoboFirmware.#el(trm[device.id].linksw, "span", null, [], {style: "display: inline-block; vertical-align: top;"}) // to control wrapping
            trm[device.id].links = {
                download:   KoboFirmware.#el(linksw1, "a",      "Download",         ["kfw-latest__links__download"],   {style: "display: none;", rel: "noopener"}),
                notes:      KoboFirmware.#el(linksw1, "a",      "Notes",            ["kfw-latest__links__notes"],      {style: "display: none;", rel: "noopener", target: "_blank"}),
                affiliates: KoboFirmware.#el(linksw2, "button", "Other Affiliates", ["kfw-latest__links__affiliates"], {style: "display: none;"}),
                versions:   KoboFirmware.#el(linksw2, "button", "Other Versions",   ["kfw-latest__links__versions"],   {}),
            }
            trm[device.id].links.versions.addEventListener("click", ev => {
                KoboFirmware.#modal(`Other versions for ${device.name}`, async () => {
                    const frag = document.createDocumentFragment()
                    for (const version of await this.#db.versionsForDevice(device.id)) {
                        if (!version.download.includes(device.hardware))
                            console.warn("possible hardware mismatch", device, version)
                        const el = KoboFirmware.#el(frag, "div", `${version.version} - ${version.date} - <a href="${version.download}" rel="noopener">Download</a> - ${device.hardware}`, [], {}, true)

                        // stats
                        this.#ctr(el.querySelector("a"),
                            [`dl`, "Firmware"],
                            [`dl-version-${version.version}`, `Firmware ${version.version}`],
                            [`dl-device-${device.id.replace(/^[0-]+/, "")}`, `${device.hardware} / ${device.name}`],
                        )
                    }
                    return frag
                })
                ev.preventDefault()
            })
        }
        table.querySelector("tbody").appendChild(trs)

        // load each row async as data becomes available
        await Promise.all(this.#devices.map(device => (async device => {
            try {
                // load the latest update info and the affiliates which have it
                let latest, latests = []
                for (const affiliate of this.#affiliates) {
                    let info
                    try {
                        info = await this.#req[device.id][affiliate]
                    } catch (ex) {
                        // retry once more
                        this.#req[device.id][affiliate] = this.#kfw.latestVersion(device.id, affiliate)
                        info = await this.#req[device.id][affiliate]
                    }
                    switch (KFWProxy.versionCompare(latest?.UpgradeVersion, info.UpgradeVersion)) {
                        case -1: // !latest || latest < info
                            latest = info
                            latests = [affiliate]
                            break
                        case 0: // latest == info
                            latests.push(affiliate)
                            break
                    }
                }

                // table cells
                trm[device.id].version.textContent = latest.UpgradeVersion
                trm[device.id].date.textContent    = latest.UpgradeDate
                trm[device.id].version.setAttribute("title", `Affiliates with version: ${latests.join(", ")}`)

                // download
                trm[device.id].links.download.href = latest.UpgradeURL
                trm[device.id].links.download.style.removeProperty("display")

                // release notes
                trm[device.id].links.notes.href = latest.ReleaseNoteURL
                trm[device.id].links.notes.addEventListener("click", ev => {
                    if (navigator.userAgent.includes("MSIE") || navigator.userAgent.includes("Trident/")) {
                        return // doesn't support srcdoc
                    }
                    KoboFirmware.#modal(`Release notes for ${latest.UpgradeVersion}`, async () => {
                        const content = await this.#kfw.ReleaseNotes(latest.ReleaseNoteURL)
                        const frame = document.createElement("iframe")
                        frame.srcdoc = content
                        frame.setAttribute("sandbox", "")
                        return frame
                    })
                    ev.preventDefault()
                });
                trm[device.id].links.notes.style.removeProperty("display")

                // affiliates
                trm[device.id].links.affiliates.addEventListener("click", ev => {
                    KoboFirmware.#modal(`Versions of other affiliates for ${device.name}`, async () => {
                        const frag = document.createDocumentFragment()
                        for (const affiliate in this.#req[device.id]) {
                            const info = await this.#req[device.id][affiliate]
                            const a = KoboFirmware.#el(frag, "div", `${affiliate} - ${info.UpgradeVersion}${info.UpgradeURL ? ` - <a href="${info.UpgradeURL}" rel="noopener">Download</a>` : ``}`, [], {}, true)

                            // stats
                            this.#ctr(a,
                                [`dl`, "Firmware"],
                                [`dl-version-${info.UpgradeVersion}`, `Firmware ${info.UpgradeVersion}`],
                                [`dl-device-${device.id.replace(/^[0-]+/, "")}`, `${device.hardware} / ${device.name}`],
                            )
                        }
                        return frag
                    }, ["thin"])
                    ev.preventDefault()
                });
                trm[device.id].links.affiliates.style.removeProperty("display")

                // stats
                this.#ctr(trm[device.id].links.download,
                    [`dl`, "Firmware"],
                    [`dl-version-${latest.UpgradeVersion}`, `Firmware ${latest.UpgradeVersion}`],
                    [`dl-device-${device.id.replace(/^[0-]+/, "")}`, `${device.hardware} / ${device.name}`],
                )
            } catch (ex) {
                trm[device.id].version.textContent = "Error"
                trm[device.id].version.setAttribute("title", `Error: ${ex}`)
                Sentry.captureException(new Error(`Table row load failed for "${device.name}" in latest versions table: ${ex}`))
            }
        })(device)))
    }

    async renderMatrix(table) {
        // this one is built horizontally
        let rows = {}
        const tb = table.querySelector("tbody")
        rows.header = table.querySelector("thead tr")

        // add a column for the device names
        KoboFirmware.#el(rows.header, "th", "Device", ["kfw-matrix__device"])
        for (const device of this.#devices) {
            rows[device.id] = KoboFirmware.#el(tb, "tr")
            KoboFirmware.#el(rows[device.id], "td", device.name, ["kfw-matrix__device"])
        }

        // add the version columns all at once (since there are a lot of them)
        let cols = {}
        const availability = await this.#db.versionsByDevice()
        for (const version of await this.#db.versions()) {
            KoboFirmware.#el((cols.header = cols.header || document.createDocumentFragment()), "th", version, ["kfw-matrix__version"])
            for (const device of this.#devices) {
                const date = availability[device.id][version]
                let t, c, a
                if (date) {
                    t = "✓"
                    c = "kfw-matrix__version--yes"
                    a = {title: date}
                } else if (KFWProxy.versionCompare(availability[device.id].earliest, version) == 1) {
                    // TODO: make this check more efficient by doing it separately going through the versions backwards
                    t = "-"
                    c = "kfw-matrix__version--none"
                    a = {}
                } else {
                    t = "✗"
                    c = "kfw-matrix__version--no"
                    a = {}
                }
                KoboFirmware.#el((cols[device.id] = cols[device.id] || document.createDocumentFragment()), "td", t, ["kfw-matrix__version", c], a)
            }
        }
        for (const row in cols)
            rows[row].appendChild(cols[row])

        // add a column for the device names
        KoboFirmware.#el(rows.header, "th", "Device", ["kfw-matrix__device"])
        for (const device of this.#devices)
            KoboFirmware.#el(rows[device.id], "td", device.name, ["kfw-matrix__device"])
    }

    async renderAffiliates(table) {
        const ths = document.createDocumentFragment()
        KoboFirmware.#el(ths, "th", "Device", ["kfw-affiliates__device"])
        for (const affiliate of this.#affiliates)
            KoboFirmware.#el(ths, "th", affiliate, ["kfw-affiliates__affiliate"])
        table.querySelector("thead tr").appendChild(ths)

        // load the initial data
        const trm = {}
        const trs = document.createDocumentFragment()
        for (const device of this.#devices) {
            const tr = KoboFirmware.#el(trs, "tr")
            trm[device.id] = {}
            KoboFirmware.#el(tr, "td", device.name, ["kfw-affiliates__device"])
            for (const affiliate of this.#affiliates)
                trm[device.id][affiliate] = KoboFirmware.#el(tr, "td", "Loading", ["kfw-affiliates__affiliate"])
        }
        table.querySelector("tbody").appendChild(trs)

        // load each cell async as data becomes available (we use traditional
        // promise chaining here to improve performance by reducing the number
        // of pending async functions at once)
        return Promise.all(this.#devices.map(device =>
            Promise.all(this.#affiliates.map(affiliate =>
                this.#req[device.id][affiliate]
                    .then(obj => {
                        trm[device.id][affiliate].textContent = obj.UpgradeVersion == "0.0"
                            ? "-"
                            : obj.UpgradeVersion
                        return Promise.resolve([affiliate, obj])
                    }).catch(ex => {
                        trm[device.id][affiliate].textContent = "Error"
                        trm[device.id][affiliate].title = `Error: ${ex}`
                        return Promise.reject(ex)
                    })
            )).then(affiliates => {
                let latest
                for (const [, info] of affiliates)
                    if (KFWProxy.versionCompare(latest?.UpgradeVersion, info.UpgradeVersion) == -1)
                        latest = info
                for (const [affiliate, info] of affiliates)
                    trm[device.id][affiliate].classList.add(
                        latest.UpgradeVersion == info.UpgradeVersion
                            ? "kfw-affiliates__affiliate--latest"
                            : info.UpgradeVersion == "0.0"
                                ? "kfw-affiliates__affiliate--none"
                                : "kfw-affiliates__affiliate--outdated")
            })
        ))
    }

    async renderVersions(table) {
        let hardware = {}
        let name = {}
        let idhardware = {}
        for (const device of this.#devices) {
            hardware[device.hardware] = null
            name[device.id] = device.name
            idhardware[device.id] = device.hardware
        }
        hardware = Object.keys(hardware).sort((a, b) => a.localeCompare(b))
        
        const ths = document.createDocumentFragment()
        KoboFirmware.#el(ths, "th", "Date",    ["kfw-versions__date"])
        KoboFirmware.#el(ths, "th", "Version", ["kfw-versions__version"])
        for (const hw of hardware)
            KoboFirmware.#el(ths, "th", hw,    ["kfw-versions__hardware"])
        KoboFirmware.#el(ths, "th", "Notes",   ["kfw-versions__notes"])
        table.querySelector("thead tr").appendChild(ths)

        const rows = document.createDocumentFragment()
        for (const version of await this.#db.downloadsByVersion()) {
            const row = KoboFirmware.#el(rows, "tr")
            KoboFirmware.#el(row, "td", version.date,    ["kfw-versions__date"])
            KoboFirmware.#el(row, "td", version.version, ["kfw-versions__version"])
            for (const hw of hardware) {
                const td = KoboFirmware.#el(row, "td", version.download[hw] ? "" : "-", ["kfw-versions__hardware"])
                if (version.download[hw]) {
                    const a = KoboFirmware.#el(td, "a", "Download", [], {rel: "noopener", href: version.download[hw], title: KoboFirmware.#listify(version.for.filter(id => idhardware[id] == hw).map(id => name[id].replace(/Kobo /, "")))})

                    // stats
                    this.#ctr(el.querySelector("a"),
                        [`dl`, "Firmware"],
                        [`dl-version-${version.version}`, `Firmware ${version.version}`],
                    )
                }
            }
            const x = version.notfor.length
                ? version.for.length > version.notfor.length
                    ? `Not for ${KoboFirmware.#listify(version.notfor.map(id => name[id].replace(/Kobo /, "")))}.`
                    : `Only for ${KoboFirmware.#listify(version.for.map(id => name[id].replace(/Kobo /, "")))}.`
                : ""
            KoboFirmware.#el(row, "td", x, ["kfw-versions__notes"])
        }
        table.querySelector("tbody").appendChild(rows)
    }

    static #listify(arr) {
        if (!arr || arr.length == 0)
            return ""
        if (arr.length == 1)
            return arr[0].toString()
        if (arr.length == 2)
            return arr.join(" and ")
        return `${arr.slice(0, arr.length-1).join(", ")}, and ${arr[arr.length-1]}`
    }

    static #modal(title, fn, classes = []) {
        const modal = KoboFirmware.#el(null,  "aside",  null,      ["modal-wrapper"])
        const inner = KoboFirmware.#el(modal, "div",    null,      ["modal", ...classes])
        const bar   = KoboFirmware.#el(inner, "div",    null,      ["titlebar"])
        const close = KoboFirmware.#el(bar,   "button", "Close",   ["close"])
        const text  = KoboFirmware.#el(bar,   "div",    title,     ["title"])
        const body  = KoboFirmware.#el(inner, "div",    "Loading", ["body"])
        
        const cfn = ev => {
            if (ev) {
                if (ev.target != close && ev.target != modal && ev.keyCode != 27) {
                    return // !close && !back && !esc
                }
                ev.preventDefault()
            }
            document.body.removeChild(modal)
            document.body.removeEventListener("keydown", cfn, true)
        }
        modal.addEventListener("click", cfn, true)
        document.body.addEventListener("keydown", cfn, true)
        document.body.appendChild(modal)

        {(async () => {
            try {
                let res = fn()
                if (res instanceof Promise)
                    res = await res
                if (typeof res === "string") {
                    body.innerHTML = res
                } else if (res instanceof HTMLIFrameElement) {
                    res.classList.add("body")
                    res.style.border = "none"
                    res.style.width = "100%"
                    res.style.height = "100%"
                    res.style.padding = 0
                    inner.removeChild(body)
                    inner.appendChild(res)
                } else {
                    body.innerHTML = ""
                    body.appendChild(res)
                }
            } catch (ex) {
                body.innerHTML = `Error: Load failed: ${ex}`
                console.error("modal load failed", ex)
                Sentry.captureException(new Error(`Modal load failed for "${title}": ${ex}`))
            }
        })()}

        return {title: text, body, close: () => cfn(null)}
    }

    static #el(parent, tag, inner = null, classes = [], attrs = {}, raw = false) {
        const el = document.createElement(tag)
        for (const c of classes)
            el.classList.add(c)
        for (const a in attrs)
            el.setAttribute(a, attrs[a])
        if (inner)
            el[raw ? "innerHTML" : "textContent"] = inner.toString()
         if (parent)
            parent.appendChild(el)
        return el
    }
}

Sentry.init({
    dsn: "https://696a706ba440443eb3e19094ebd72f74@o143001.ingest.sentry.io/1104793",
    maxBreadcrumbs: 100,
    attachStacktrace: true,
})

const app = window.app = new KoboFirmware()
app.renderLatest(document.getElementById("kfw-latest"))
    .catch(ex => Sentry.captureException(new Error(`Table load failed for #kfw-latest`)))
app.renderMatrix(document.getElementById("kfw-matrix"))
    .catch(ex => Sentry.captureException(new Error(`Table load failed for #kfw-matrix`)))
app.renderAffiliates(document.getElementById("kfw-affiliates"))
    .catch(ex => Sentry.captureException(new Error(`Table load failed for #kfw-affiliates`)))
app.renderVersions(document.getElementById("kfw-versions"))
    .catch(ex => Sentry.captureException(new Error(`Table load failed for #kfw-versions`)))
document.getElementById("error").className = "error hidden";
