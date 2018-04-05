// affiliates are the affiliates to check.
var affiliates = [
    "kobo",
    "bestbuyca",
    "fnac",
    "beta",
    "rakutenbooks",
    "walmartca"
];

// devices are the devices to check.
var devices = [
    ["00000000-0000-0000-0000-000000000310", "Kobo Touch A/B", "kobo3"],
    ["00000000-0000-0000-0000-000000000320", "Kobo Touch C", "kobo4"],
    ["00000000-0000-0000-0000-000000000340", "Kobo Mini", "kobo4"],
    ["00000000-0000-0000-0000-000000000330", "Kobo Glo", "kobo4"],
    ["00000000-0000-0000-0000-000000000371", "Kobo Glo HD", "kobo6"],
    ["00000000-0000-0000-0000-000000000372", "Kobo Touch 2.0", "kobo6"],
    ["00000000-0000-0000-0000-000000000360", "Kobo Aura", "kobo5"],
    ["00000000-0000-0000-0000-000000000350", "Kobo Aura HD", "kobo4"],
    ["00000000-0000-0000-0000-000000000370", "Kobo Aura H2O", "kobo5"],
    ["00000000-0000-0000-0000-000000000374", "Kobo Aura H2O Edition 2", "kobo6"],
    ["00000000-0000-0000-0000-000000000373", "Kobo Aura ONE", "kobo6"],
    ["00000000-0000-0000-0000-000000000381", "Kobo Aura ONE Limited Edition", "kobo6"],
    ["00000000-0000-0000-0000-000000000375", "Kobo Aura Edition 2", "kobo6"]
];

// fwVersionCompare compares 2 kobo firmware versions and
// returns 1 if a > b, 0 if a == b, -1 if a < b.
function fwVersionCompare(a, b) {
    var as = a.split(".").map(Number);
    var bs = b.split(".").map(Number);

    for (var i = 0; i < Math.max(as.length, bs.length); i++) {
        if (as[i] == 0 && bs[i] == null) return 0;
        if (as[i] == null && bs[i] == 0) return 0;
        if (as[i] == null) return -1;
        if (bs[i] == null) return 1;
        if (as[i] > bs[i]) return 1;
        if (as[i] < bs[i]) return -1;
    }
    return 0;
}

// fwExtractVersion extracts the version from a firmware download URL.
function fwExtractVersion(url) {
    var tmp = url.match(/update-([0-9.]+)\.zip/);
    if (tmp == null || tmp.length != 2) throw new Error("Could not extract version from " + url);
    return tmp[1];
}

// fwExtractDate extracts the release date from a firmware download URL.
function fwExtractDate(url, version) {
    var overrides = {
        "3.4.1": "May 2014",
        "4.6.9960": "October 2017",
        "4.6.10075": "November 2017"
    };
    if (overrides[version]) return overrides[version];

    var monthOverrides = {
        "Jan": "January",
        "Feb": "February",
        "Mar": "March",
        "Apr": "April",
        "Jun": "June",
        "Jul": "July",
        "Aug": "August",
        "Sep": "September",
        "Oct": "October",
        "Nov": "November",
        "Dec": "December",
        "Rakuten-": "Unknown"
    };
    var tmp = url.match(/\/firmwares\/kobo[0-9]\/(.+?)\//);
    if (tmp == null || tmp.length != 2) throw new Error("Could not extract date from " + url);

    var spl = tmp[1].replace(/([0-9]+)/, " $1").split(" ");
    var month = spl[0];
    var year = spl[1];
    month = month.charAt(0).toUpperCase() + month.slice(1);
    if (monthOverrides[month]) month = monthOverrides[month];
    return [month, year].join(" ").trim();
}

// jsonp makes a jsonp request.
function jsonp(url, timeout) {
    return new Promise(function (resolve, reject) {
        var callback;
        while (!callback || window[callback] !== undefined) {
            callback = "JSONP_" + (Math.random() + 1).toString(36).slice(2);
        }

        var t = setTimeout(function () {
            delete window[callback];
            script.remove();
            reject("Connection timed out");
        }, timeout || 30000);

        window[callback] = function (data) {
            clearTimeout(t);
            delete window[callback];
            script.parentNode.removeChild(script);
            resolve(data);
        };

        var script = document.createElement("script");
        script.src = "https://json2jsonp.com/" + '?url=' + encodeURIComponent(url) +
            '&callback=' +
            encodeURIComponent(callback);
        document.body.appendChild(script);
    });
}

function getUpgradeInfo(id, affiliate) {
    return jsonp("https://api.kobobooks.com/1.0/UpgradeCheck/Device/" + id + "/" + affiliate + "/0.0/N0", 15000);
}

function getVersions() {
    document.querySelector(".firmware .devices").innerHTML = "";
    return Promise.all(devices.map(function (device) {
        return {
            id: device[0],
            model: device[1],
            hardware: device[2]
        };
    }).map(function (device) {
        var tr = document.querySelector(".firmware .devices").appendChild(document.createElement("tr"));
        tr.classList.add("device");
        tr.setAttribute("data-id", device.id);

        if (navigator.userAgent.indexOf("Kobo Touch " + device.id.slice(-4)) > -1) tr.classList.add("highlight");

        var model = tr.appendChild(document.createElement("td"));
        model.classList.add("model");
        model.innerText = device.model;
        model.title = "ID: " + device.id;

        var hardware = tr.appendChild(document.createElement("td"));
        hardware.classList.add("hardware");
        hardware.innerText = device.hardware;

        var version = tr.appendChild(document.createElement("td"));
        version.classList.add("version");
        version.innerHTML = '<img src="loader.gif" alt="Loading..." class="loader" />'

        var date = tr.appendChild(document.createElement("td"));
        date.classList.add("date");

        var links = tr.appendChild(document.createElement("td"));
        links.classList.add("links");

        var download = links.appendChild(document.createElement("a"));
        download.classList.add("link");
        download.classList.add("download");
        download.classList.add("hidden");
        download.href = "javascript:void(0);";
        download.innerText = "Download";

        var notes = links.appendChild(document.createElement("a"));
        notes.classList.add("link");
        notes.classList.add("notes");
        notes.classList.add("hidden");
        notes.target = "_blank";
        notes.href = "javascript:void(0);";
        notes.innerText = "Notes";

        var otherAffiliates = links.appendChild(document.createElement("a"));
        otherAffiliates.classList.add("link");
        otherAffiliates.classList.add("other-affiliates");
        otherAffiliates.classList.add("hidden");
        otherAffiliates.href = "javascript:void(0);";
        otherAffiliates.innerText = "Other Affiliates";

        var otherVersions = links.appendChild(document.createElement("a"));
        otherVersions.classList.add("link");
        otherVersions.classList.add("other-versions");
        otherVersions.href = "javascript:void(0);";
        otherVersions.innerText = "Other Versions";
        otherVersions.onclick = (function (device) {
            document.querySelector(".modal-wrapper.other-versions .title").innerHTML = "Other versions for " + device.model;
            document.querySelector(".modal-wrapper.other-versions .body").innerHTML = (oldversions && oldversions[device.id]) ? oldversions[device.id].map(function (version) {
                return [
                    version.version,
                    version.date,
                    '<a href="' + version.download + '">Download</a>',
                    version.hardware
                ].join(" - ");
            }).join("<br />") : "Unknown";
            document.querySelector(".modal-wrapper.other-versions").classList.remove("hidden");
        }).bind(null, device);

        return [device, {
            tr: tr,
            model: model,
            hardware: hardware,
            version: version,
            date: date,
            links: links,
            download: download,
            notes: notes,
            otherAffiliates: otherAffiliates,
            otherVersions: otherVersions
        }];
    }).map(function (t) {
        var device = t[0];
        var els = t[1];
        return Promise.all(affiliates.map(function (affiliate) {
            return getUpgradeInfo(device.id, affiliate).then(function (response) {
                return Promise.resolve({
                    affiliate: affiliate,
                    download: response.UpgradeURL,
                    notes: response.ReleaseNoteURL
                });
            }).then(function (result) {
                result.version = fwExtractVersion(result.download);
                return result;
            }).then(function (result) {
                result.date = fwExtractDate(result.download, result.version);
                return result;
            });
        })).then(function (results) {
            var latest = results.sort(function (a, b) {
                return fwVersionCompare(a.version, b.version);
            }).reverse()[0];

            return Promise.resolve({
                id: device.id,
                model: device.model,
                hardware: device.hardware,
                latest: {
                    affiliates: results.filter(function (result) {
                        return result.version == latest.version;
                    }).map(function (result) {
                        return result.affiliate;
                    }),
                    version: latest.version,
                    date: latest.date,
                    download: latest.download,
                    notes: latest.notes
                },
                affiliates: results
            });
        }).then(function (device) {
            els.version.innerText = device.latest.version;
            els.version.title = "Affiliates with latest version: " + device.latest.affiliates.join(", ");

            els.date.innerText = device.latest.date;

            els.download.href = device.latest.download;
            els.download.classList.remove("hidden");

            els.notes.href = device.latest.notes;
            els.notes.classList.remove("hidden");
            els.notes.onclick = (function (device, event) {
                event.preventDefault();
                document.querySelector(".modal-wrapper.notes .title").innerHTML = "Release notes for " + device.latest.version;
                window.open(device.latest.notes.replace("http:", "https:"), "notes");
                document.querySelector(".modal-wrapper.notes").classList.remove("hidden");
            }).bind(null, device);

            els.otherAffiliates.classList.remove("hidden");
            els.otherAffiliates.onclick = (function (device) {
                document.querySelector(".modal-wrapper.other-affiliates .title").innerHTML = "Versions of other affiliates for " + device.model;
                document.querySelector(".modal-wrapper.other-affiliates .body").innerHTML = device.affiliates.map(function (affiliate) {
                    return [
                        affiliate.affiliate,
                        affiliate.version,
                        '<a href="' + affiliate.download + '">Download</a>'
                    ].join(" - ");
                }).join("<br />");
                document.querySelector(".modal-wrapper.other-affiliates").classList.remove("hidden");
            }).bind(null, device);

            updateFilter();

            return Promise.resolve(device);
        }).catch(function (err) {
            els.version.innerText = "Error";
            els.version.title = err.toString();
            try {Raven.captureException(err);} catch (err) {}
            return Promise.reject(new Error("Error loading firmware for " + device.model + ": " + err.toString()));
        });
    })).then(function (results) {
        // If all were successful
        console.log(results);

        var latestVersion = results.map(function (result) {
            return result.latest.version;
        }).sort(fwVersionCompare).reverse()[0];

        document.querySelector(".bbcode-text").innerHTML = [
            '[SIZE=5]Kobo Firmware ' + latestVersion + '[/SIZE]\n\n',
            'Kobo firmware ' + latestVersion + ' has been released. ',
            'As of ',
            (function formatDate(date) {
                var monthNames = ["January", "February", "March", "April",
                    "May", "June", "July", "August", "September", "October",
                    "November", "December"
                ];
                var day = date.getDate();
                var monthIndex = date.getMonth();
                var year = date.getFullYear();
                return monthNames[monthIndex] + ' ' + day + ', ' + year;
            })(new Date()),
            ', it has been released to the devices: ',
            results.filter(function (result) {
                return result.latest.version == latestVersion;
            }).map(function (result) {
                return result.model;
            }).join(', '),
            '. It has not been released to the: ',
            results.filter(function (result) {
                return result.latest.version != latestVersion;
            }).map(function (result) {
                return result.model;
            }).join(', '),
            '. The affiliates used to check these firmware versions were: ',
            affiliates.join(', '),
            '. \n\n\n',
            '[SIZE=5]Download Links[/SIZE]\n\n',
            '[B]Official Links: [/B]\n',
            '[LIST]\n',
            '[*]' + results.filter(function (result) {
                return result.latest.version == latestVersion;
            }).map(function (result) {
                return [
                    '[B]' + result.model + '[/B] ',
                    '(' + result.hardware.replace("kobo", "mark ") + ') - ',
                    '[URL=' + result.latest.download + ']Download[/URL] | ',
                    '[URL=' + result.latest.notes + ']Release Notes[/URL]'
                ].join("");
            }).join('\n[*]'),
            '\n[/LIST]\n',
            '[B]You can also try the generic links at your own risk: [/B]\n',
            '[LIST]\n',
            '[*]' + ["3", "4", "5", "6"].map(function (n) {
                return [
                    '[B]Mark ' + n.toString() + '[/B] - ',
                    '[URL=',
                    results.filter(function (result) {
                        return result.latest.version == latestVersion;
                    }).reverse()[0].latest.download.replace(/kobo[0-9]/, "kobo" + n.toString()),
                    ']Download[/URL]'
                ].join("");
            }).join('\n[*]'),
            '\n[/LIST]\n\n',
            '[SIZE=1]',
            'Generated by [URL=https://geek1011.github.io/KoboStuff/kobofirmware.html]kobofirmware[/URL] ',
            'by [URL=https://github.com/geek1011]Patrick G (geek1011)[/URL]. ',
            '[URL=https://github.com/geek1011/KoboStuff/blob/gh-pages/kobofirmware.html]Source Code[/URL]',
            '[/SIZE]'
        ].join("");
    }).catch(function (err) {
        // If any one failed, returns the first one which did
        // No need to display error, as it will show in the table.
        document.querySelector(".bbcode-text").innerHTML = "Error generating bbcode: Could not get firmware for all devices: " + err.toString();
        console.error(err);
        try {Raven.captureException(err);} catch (err) {}
    });
}

function updateFilter() {
    var q = document.querySelector(".filter").value.toLowerCase().trim();
    [].slice.call((document.querySelectorAll(".firmware .devices .device"))).forEach(function (device) {
        device.classList.add("hidden");
        ([
            device.getAttribute("data-id"),
            device.querySelector(".model").innerText,
            device.querySelector(".hardware").innerText,
            device.querySelector(".version").innerText,
            device.querySelector(".date").innerText
        ].some(function (value) {
            if (q == "") return true;
            if ((value || "").trim() == "") return false;
            return q.indexOf((value || "").toLowerCase().trim()) > -1 || (value || "").toLowerCase().trim().indexOf(q) > -1;
        })) && device.classList.remove("hidden");
    });
}

function init() {
    document.getElementById("error").className = "error hidden";
    try {
        document.querySelector(".filter").addEventListener("input", updateFilter);
        document.querySelector(".filter").addEventListener("keyup", updateFilter);
        getVersions().catch(function (err) {
            console.error(err);
            document.getElementById("error").className = "error";
            document.getElementById("error").innerHTML = document.getElementById("error").innerHTML + '<br /><br />' + err.toString();
            try {Raven.captureException(err);} catch (err) {}
            alert("Error loading firmware: " + err.toString());
        });
    } catch (err) {
        console.error(err);
        document.getElementById("error").className = "error";
        document.getElementById("error").innerHTML = document.getElementById("error").innerHTML + '<br /><br />' + err.toString();
        try {Raven.captureException(err);} catch (err) {}
    }

    if (navigator.userAgent.toLowerCase().indexOf("kobo") > -1) document.querySelector(".top-ad").style.display = "none";
}

init();
