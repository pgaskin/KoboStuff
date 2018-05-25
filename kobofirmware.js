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
    ["00000000-0000-0000-0000-000000000374", "Kobo Aura H2O Edition 2 v1", "kobo6"],
    ["00000000-0000-0000-0000-000000000378", "Kobo Aura H2O Edition 2 v2", "kobo7"],
    ["00000000-0000-0000-0000-000000000373", "Kobo Aura ONE", "kobo6"],
    ["00000000-0000-0000-0000-000000000381", "Kobo Aura ONE Limited Edition", "kobo6"],
    ["00000000-0000-0000-0000-000000000375", "Kobo Aura Edition 2 v1", "kobo6"],
    ["00000000-0000-0000-0000-000000000379", "Kobo Aura Edition 2 v2", "kobo7"]
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
    if (url == null) return "0.0.0";
    if (url.endsWith("download.kobobooks.com/firmwares/kobo7/April2018/kobo-update-4.8.zip")) return "4.8.10956"; // Make sure this still applies (because of the v2 devices) after each release
    var tmp = url.match(/update-([0-9.]+)\.zip/);
    if (tmp == null || tmp.length != 2) throw new Error("Could not extract version from " + url);
    return tmp[1];
}

// fwExtractDate extracts the release date from a firmware download URL.
function fwExtractDate(url, version) {
    if (url == null || version == "0.0.0") return "None";

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

// listify makes an array into an English list.
function listify(arr, noandthe) {
    var and = noandthe ? " and " : " and the ";
    if (arr.length == 1) return arr[0];
    if (arr.length == 2) return arr.join(and);
    return arr.slice(0, arr.length - 1).join(", ") + ", " + and + arr[arr.length - 1];
}

// el creates an element.
// tag is the tag.
// classes is either a single class as a string or an array of classes.
// attrs is an object.
// inner is a string.
// innerRaw is a bool. If true, innerHTML is set instead of innerText.
// appendTo is an element to append to or null.
function el(tag, classes, attrs, inner, innerRaw, appendTo) {
    var el = document.createElement(tag);
    if (classes) {
        if (Array.isArray(classes)) {
            classes.forEach(function (c) {
                el.classList.add(c);
            });
        } else {
            el.classList.add(classes.toString());
        }
    }
    if (attrs) {
        Object.entries(attrs).forEach(function (attr) {
            el.setAttribute(attr[0], attr[1]);
        });
    }
    if (inner) {
        if (innerRaw) {
            el.innerHTML = inner.toString();
        } else {
            el.innerText = inner.toString();
        }
    }
    if (appendTo) {
        appendTo.appendChild(el);
    }
    return el;
}

// jsonp makes a jsonp request.
function jsonp(url, timeout) {
    try {
        Raven.captureBreadcrumb({
            message: 'JSONP request to ' + url,
            category: 'jsonp',
            data: {
                url: url,
                timeout: timeout
            }
        });
    } catch (err) {}
    return new Promise(function (resolve, reject) {
        var callback;
        while (!callback || window[callback] !== undefined) {
            callback = "JSONP_" + (Math.random() + 1).toString(36).slice(2);
        }

        var t = setTimeout(function () {
            delete window[callback];
            script.parentNode.removeChild(script);
            reject("Connection timed out");
        }, timeout || 30000);

        window[callback] = function (data) {
            clearTimeout(t);
            delete window[callback];
            script.parentNode.removeChild(script);
            resolve(data);
        };

        var script = el("script", [], {
            src: "https://json2jsonp.com/" + "?url=" + encodeURIComponent(url) + "&callback=" + encodeURIComponent(callback)
        }, "", false, document.body);
    });
}

function getUpgradeInfo(id, affiliate) {
    var baseVer = "0.0";
    if (id == "00000000-0000-0000-0000-000000000381") baseVer = "4.7.10364";
    return jsonp("https://api.kobobooks.com/1.0/UpgradeCheck/Device/" + id + "/" + affiliate + "/" + baseVer + "/N0", 30000);
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
        var tr = el("tr", "device", {
            "data-id": device.id
        }, "", false, document.querySelector(".firmware .devices"));
        if (navigator.userAgent.indexOf("Kobo Touch " + device.id.slice(-4)) > -1) tr.classList.add("highlight");

        var model = el("td", "model", {
            title: "ID: " + device.id
        }, device.model, false, tr);

        var hardware = el("td", "hardware", {}, device.hardware, false, tr);
        var version = el("td", "version", {}, '<img src="loader.gif" alt="Loading..." class="loader" />', true, tr);
        var date = el("td", "date", {}, "", false, tr);
        var links = el("td", "links", {}, "", false, tr);

        var download = el("a", ["link", "download", "hidden"], {
            href: "javascript:void(0);"
        }, "Download", false, links);

        var notes = el("a", ["link", "notes", "hidden"], {
            href: "javascript:void(0);",
            target: "_blank"
        }, "Notes", false, links);

        var otherAffiliates = el("a", ["link", "other-affiliates", "hidden"], {
            href: "javascript:void(0);"
        }, "Other Affiliates", false, links);

        var otherVersions = el("a", ["link", "other-versions"], {
            href: "javascript:void(0);"
        }, "Other Versions", false, links);
        otherVersions.onclick = (function (device) {
            document.querySelector(".modal-wrapper.other-versions .title").innerHTML = "Other versions for " + device.model;
            document.querySelector(".modal-wrapper.other-versions .body").innerHTML = (oldversions && oldversions[device.id]) ? oldversions[device.id].versions.map(function (version) {
                return [
                    version.version,
                    version.date,
                    '<a href="' + version.download + '">Download</a>',
                    oldversions[device.id].hardware
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
            try {
                Raven.captureException(err);
            } catch (err) {}
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
            ', it has been released to the ',
            listify(results.filter(function (result) {
                return result.latest.version == latestVersion;
            }).map(function (result) {
                return result.model;
            })),
            '. It has not been released to the ',
            listify(results.filter(function (result) {
                return result.latest.version != latestVersion;
            }).map(function (result) {
                return result.model;
            })),
            '. The affiliates used to check these firmware versions were: ',
            listify(affiliates),
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
            '[*]' + ["3", "4", "5", "6", "7"].map(function (n) {
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

        var affvers = results.map(function (d) {
            return [d.model, d.affiliates.map(function (a) {
                return [a.affiliate, a.version];
            }).reduce(function (acc, i) {
                acc[i[0]] = i[1];
                return acc;
            }, {})];
        }).reduce(function (acc, i) {
            acc[i[0]] = i[1];
            return acc;
        }, {});
        var devs = Object.keys(affvers).sort(alpha);

        [
            el("th", "device", {}, "Device")
        ].concat(affiliates.map(function (a) {
            return el("th", "affiliate", {}, a)
        })).forEach(function (h) {
            document.querySelector(".affiliate-version thead tr").appendChild(h);
        });

        Object.entries(affvers).map(function (affver) {
            var tr = el("tr");
            var f = false;
            [
                el("td", "device", {}, affver[0])
            ].concat(affiliates.map(function (a) {
                var v = affver[1][a];
                var l = (results.filter(function (r) {
                    return r.model == affver[0];
                }).map(function (r) {
                    return r.latest.version;
                })[0] || "") == v;
                if (v == "0.0.0") l = false;
                return el("td", ["affiliate", l ? "latest" : (v == "0.0.0" ? "none" : "old")], {}, v)
            })).forEach(function (col) {
                tr.appendChild(col);
            });
            return tr;
        }).forEach(function (row) {
            document.querySelector(".affiliate-version tbody").appendChild(row);
        });

        document.querySelector(".affver-container").classList.remove("hidden");
    }).catch(function (err) {
        // If any one failed, returns the first one which did
        // No need to display error, as it will show in the table.
        document.querySelector(".bbcode-text").innerHTML = "Error generating bbcode: Could not get firmware for all devices: " + err.toString();
        console.error(err);
        try {
            Raven.captureException(err);
        } catch (err) {}
    });
}

function updateFilter() {
    var q = document.querySelector(".filter.devs").value.toLowerCase().trim();
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

// uniq can be used with Array.filter to filter unique values.
function uniq(value, index, self) {
    return self.indexOf(value) === index;
}

// objFrom creates an object from an array of key-value pairs.
function objFrom(arr) {
    return arr.reduce(function (prev, curr) {
        prev[curr[0]] = curr[1];
        return prev;
    }, {});
}

// hwCompare compares hardware revisions.
function hwCompare(a, b) {
    return a > b;
}

function loadPrevVersions() {
    var hardwares = Object.values(oldversions).map(function (d) {
        return d.hardware;
    }).filter(uniq).sort(hwCompare);

    [
        el("th", "date", {}, "Date")
    ].concat([
        el("th", "version", {}, "Version")
    ]).concat(hardwares.map(function (hw) {
        return el("th", "hardware", {}, hw);
    })).concat([
        el("th", "notes", {}, "Notes")
    ]).forEach(function (h) {
        document.querySelector(".old-firmware thead tr").appendChild(h);
    });

    var versions = [].concat.apply([], Object.values(oldversions).map(function (d) {
        return d.versions.map(function (version) {
            return version.version;
        });
    })).filter(uniq).sort(fwVersionCompare);

    versions.map(function (version) {
        return {
            version,
            matches: Object.values(oldversions).map(function (d) {
                return {
                    id: d.id,
                    model: d.model,
                    hardware: d.hardware,
                    match: d.versions.filter(function (v) {
                        return v.version == version;
                    })[0]
                };
            })
        };
    }).map(function (version) {
        version.yes = version.matches.filter(function (d) {
            return d.match != null;
        });
        version.no = version.matches.filter(function (d) {
            return d.match == null;
        });
        version.date = version.yes[0].match.date;
        version.downloads = version.yes.reduce(function (acc, d) {
            if (!acc[d.hardware]) acc[d.hardware] = d.match.download;
            if (acc[d.hardware] != d.match.download) console.warn("Differing hw download links", version, acc, d);
            return acc;
        }, {});
        return version;
    }).map(function (version) {
        version.yes = version.yes.filter(function (d) {
            return Object.keys(version.downloads).indexOf(d.hardware) > -1;
        }).map(function (d) {
            return d.model.replace("Kobo ", "");
        });
        version.no = version.no.filter(function (d) {
            return Object.keys(version.downloads).indexOf(d.hardware) > -1;
        }).map(function (d) {
            return d.model.replace("Kobo ", "");
        });
        ["Aura H2O Edition 2", "Aura Edition 2"].forEach(function (base) {
            var v1 = base + " v1";
            var v1i = version.no.indexOf(v1);
            var v2 = base + " v1";
            var v2i = version.no.indexOf(v2);
            if (v1i > -1 && v2i > -1) {
                version.no = version.no.filter(function (d) {
                    return d !== v1 && d !== v2;
                }).concat([base]);
            }
        });
        version.notes = "";
        if (version.no.length < 1) return version;
        if (version.yes.length > version.no.length) {
            version.notes = "Not for " + listify(version.no, true) + ".";
        } else {
            version.notes = "Only for " + listify(version.yes, true) + ".";
        }
        return version;
    }).map(function (version) {
        return [
            el("td", "date", {}, version.date || "Unknown"),
            el("td", "version", {}, version.version || "Unknown")
        ].concat(hardwares.map(function (hardware) {
            var h = el("td", "hardware");
            if (!version.downloads[hardware]) h.innerText = "-";
            if (version.downloads[hardware]) el("a", [], {href: version.downloads[hardware]}, "Download", false, h);
            return h;
        })).concat([
            el("td", "notes", {}, (version.notes))
        ]);
    }).map(function (cols) {
        var row = el("tr");
        cols.forEach(function (col) {
            row.appendChild(col);
        });
        return row;
    }).forEach(function (row) {
        document.querySelector(".old-firmware tbody").appendChild(row);
    });

    console.log(hardwares, versions);
}

// alpha compares text.
function alpha(a, b) {
    return a > b;
}

function loadVersionDeviceTable() {
    var verdevs = [].concat.apply([], Object.values(oldversions).map(function (d) {
        return d.versions;
    })).map(function (d) {
        return d.version;
    }).filter(uniq).sort(fwVersionCompare).map(function (v) {
        return [v, Object.values(oldversions).map(function (ds) {
            return [ds.model, ds.versions.some(function (d) {
                return d.version == v;
            })];
        }).reduce(function (acc, i) {
            acc[i[0]] = i[1];
            return acc
        }, {})];
    });

    var devs = Object.keys(verdevs[0][1]).sort(alpha);

    var devvers = devs.map(function (d) {
        return [d, verdevs.map(function (vd) {
            return [vd[0], Object.entries(vd[1]).some(function (dc) {
                return dc[0] == d && dc[1];
            })];
        }).reduce(function (acc, i) {
            acc[i[0]] = i[1];
            return acc
        }, {})];
    });

    var vers = Object.keys(devvers[0][1]).sort(fwVersionCompare);

    [
        el("th", "device", {}, "Device")
    ].concat(vers.map(function (ver) {
        return el("th", "version", {}, ver)
    })).concat([
        el("th", "device", {}, "Device")
    ]).forEach(function (h) {
        document.querySelector(".version-device thead tr").appendChild(h);
    });

    devvers.map(function (devver) {
        var tr = el("tr");
        var f = false;
        [
            el("td", "device", {}, devver[0])
        ].concat(vers.map(function (ver) {
            var y = devver[1][ver];
            if (y) f = true;
            if (!f) return el("td", ["version", "none"], {}, "-");
            return el("td", ["version", y ? "yes" : "no"], {}, y ? "✓" : "✗");
        })).concat([
            el("td", "device", {}, devver[0])
        ]).forEach(function (col) {
            tr.appendChild(col);
        });
        return tr;
    }).forEach(function (row) {
        document.querySelector(".version-device tbody").appendChild(row);
    });
}

function doSearch(q) {
    q = q.trim().toLowerCase().replace(/ +/g, " ").replace(/[^0-9A-Za-z._-]/, "").replace(/ ka1 /g, "kobo aura one").replace(/ ka1le /g, "kobo aura one limited edition").replace(/ ka(ed)?2/g, "kobo aura edition 2").replace(/2v1 /g, "2 v1").replace(/2v2 /g, "2 v2").replace(/touch 2 /g, "touch 2.0 ").replace(/ +/g, " ").trim();
    if (q.length < 1) return [];
    var qspl = q.split(" ");
    return [].concat.apply([], Object.values(oldversions).map(function (d) {
        return d.versions.map(function (v) {
            return {
                id: d.id,
                model: d.model,
                hardware: d.hardware,
                version: v.version,
                download: v.download,
                date: v.date
            };
        });
    })).map(function (i) {
        var score = 0;
        var id = i.id.toLowerCase(), model = i.model.toLowerCase(), hardware = i.hardware.toLowerCase();
        var version = i.version.toLowerCase(), download = i.download.toLowerCase(), date = i.date.toLowerCase();
        var kws = [
            id,
            id.slice(-3),
            id.slice(-3),
            id.slice(-3),
            model,
            date,
            version.split(".").slice(0, 2).join("."),
            download,
            download.split("/").slice(-2)[0],
            hardware,
            hardware,
            hardware,
            hardware.replace("kobo", "mark"),
            hardware.replace("kobo", "mark ")
        ].concat([
            model,
            model,
            model,
            model,
            model,
            model,
            model,
            model,
            model,
            model,
            date,
            version.split(".").join(" ")
        ].join(" ").split(" "));
        if (q == id || q == id.slice(-3) || q == model || q == model.replace("kobo ", "") || q == hardware || q == version || q == download || q == date) score += 6;
        kws.forEach(function (kw) {
            qspl.forEach(function (qsp) {
                if (qsp == kw) return score += 1;
                if (qsp.endsWith(kw) || qsp.startsWith(kw) || kw.startsWith(qsp) || kw.endsWith(qsp)) return score += 0.5;
            });
            if (kw.indexOf(" ") > -1 && q.indexOf(kw) > -1) score += kw.split(" ").length;
        });
        qspl.forEach(function (qsp) {
           var hwnorm = qsp.replace("mark", "kobo");
           if (["kobo3", "kobo4", "kobo5", "kobo6", "kobo7"].indexOf(hwnorm) > -1 && i.hardware != hwnorm) score -= 20;
           if (/^20[12][0-9]$/.test(qsp) && i.date.split(" ").reverse()[0] != qsp) score -= 10;
        });
        return [score, i];
    }).filter(function (r) {
        return qspl.length > 2 ? r[0] >= 2 : r[0] >= 0.5;
    }).sort(function (ra, rb) {
        var sa = ra[0], sb = rb[0];
        var ia = ra[1], ib = rb[1];
        if (qspl.length < 4 && (qspl.indexOf("newest") > -1 || qspl.indexOf("latest") > -1)) return fwVersionCompare(ib.version, ia.version) != 0 ? fwVersionCompare(ib.version, ia.version) : sa < sb;
        return sa != sb ? sa < sb : fwVersionCompare(ib.version, ia.version);
    }).slice(0, 50);
}

function updateSearch() {
    var q = document.querySelector(".filter.vers").value;
    var o = document.querySelector(".vers-results");
    o.innerHTML = "";
    if (q.length < 1) return;
    try {
        var results = doSearch(q);
        if (results.length < 1) return o.innerHTML = "No results found for your search. Try revising your search terms or look in the above table for the version you are trying to find.";
        var frag = document.createDocumentFragment();
        results.forEach(function (r) {
            var result = r[1];
            var rel = el("div", "result", {"data-score": r[0]}, "", false, frag);

            var r = el("div", "right", {}, "", false, rel);
            el("a", ["download", "button"], {href: result.download}, "Download", false, r);

            var l = el("div", "left", {}, "", false, rel);
            el("div", "device", {}, result.model + " - " + result.hardware, false, l);
            el("div", "version", {}, result.version + " - " + result.date, false, l);
        });
        o.appendChild(frag);
    } catch (err) {
        console.error("search error", q, err.toString());
        o.innerHTML = "Error: " + err.toString();
        throw new Error("Error searching for '" + q + "': " + err.toString());
    }
}

function init() {
    document.getElementById("error").className = "error hidden";
    try {
        document.querySelector(".filter.devs").addEventListener("input", updateFilter);
        document.querySelector(".filter.devs").addEventListener("keyup", updateFilter);
        document.querySelector(".filter.vers").addEventListener("input", updateSearch);
        document.querySelector(".filter.vers").addEventListener("keyup", updateSearch);
        getVersions().catch(function (err) {
            console.error(err);
            document.getElementById("error").className = "error";
            document.getElementById("error").innerHTML = document.getElementById("error").innerHTML + '<br /><br />' + err.toString();
            try {
                Raven.captureException(err);
            } catch (err) {}
            alert("Error loading firmware: " + err.toString());
        });
        try {
            if (oldversions) loadPrevVersions();
        } catch (err) {
            console.error("loadPrevVersions: ", err);
            document.getElementById("error").className = "error";
            document.getElementById("error").innerHTML = document.getElementById("error").innerHTML + '<br /><br />' + err.toString();
            try {
                Raven.captureException(err);
            } catch (err) {}
            alert("Error loading previous versions: " + err.toString());
        }
        try {
            if (oldversions) loadVersionDeviceTable();
        } catch (err) {
            console.error("loadVersionDeviceTable: ", err);
            document.getElementById("error").className = "error";
            document.getElementById("error").innerHTML = document.getElementById("error").innerHTML + '<br /><br />' + err.toString();
            try {
                Raven.captureException(err);
            } catch (err) {}
            alert("Error loading version availability by device table: " + err.toString());
        }
    } catch (err) {
        console.error(err);
        document.getElementById("error").className = "error";
        document.getElementById("error").innerHTML = document.getElementById("error").innerHTML + '<br /><br />' + err.toString();
        try {
            Raven.captureException(err);
        } catch (err) {}
    }

    if (navigator.userAgent.toLowerCase().indexOf("kobo") > -1) document.querySelector(".top-ad").style.display = "none";
    
    ["touch april 2018", "3.19", "kobo4 2015", "mini", "350", "kobo7", "mini \"newest firmware\"", "touch 2015", "37", "december"].forEach(function (q) {
        console.log("search test:", q, doSearch(q));
    });
}

init();