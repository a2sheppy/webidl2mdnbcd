const {extract} = require("reffy/extract-webidl");
const {parse} = require("reffy/parse-webidl");
const fs = require("fs");

const base_mdn_url = "https://developer.mozilla.org/docs/Web/API/";

const bcd_skeleton = {
  mdn_url:  "",
  support: {
    "webview_android": {
      "version_added": null
    },
    "chrome": {
      "version_added": null
    },
    "chrome_android": {
      "version_added": null
    },
    "edge": {
      "version_added": null
    },
    "edge_mobile": {
      "version_added": null
    },
    "firefox": {
      "version_added": null
    },
    "firefox_android": {
      "version_added": null
    },
    "ie": {
      "version_added": null
    },
    "opera": {
      "version_added": null
    },
    "opera_android": {
      "version_added": null
    },
    "safari": {
      "version_added": null
    },
    "safari_ios": {
      "version_added": null
    },
    "samsunginternet_android": {
      "version_added": null
    }
  },
  "status": {
    "experimental": false,
    "standard_track": true,
    "deprecated": false
  }
};

const propertiesFirst = (a,b) => a.type === b.type ? a.name.localeCompare(b.name) :  (a.type === "attribute" ? -1 : 1);

const loadBCD = path => {
  const file = fs.readFileSync(path, 'utf-8');
  return JSON.parse(file);
};

const listExistingBCD = () => {
  const existingBCD = {};
  fs.readdirSync('.')
    .filter(p => p.match(/\.json$/))
    .forEach(path => {
      const bcd = loadBCD(path);
      if (bcd.api) {
        existingBCD[Object.keys(bcd.api)[0]] = path;
      } else {
        console.error(path + " has a bogus format");
      }
    });
  return existingBCD;
}

// compare data in existing files with extracted data
const augmentExistingBCD = (existingbcd, webidlbcd) => {
  const diffs = Object.keys(webidlbcd).filter(m => !existingbcd[m]);
  diffs
    .forEach(m => existingbcd[m] = webidlbcd[m]);
  return diffs.length > 0;
  // TODO: detect issues the other way around
};

const existingBCD = listExistingBCD();
const urls = process.argv.slice(2);

urls.forEach(url => extract(url)
             .then(parse)
             .then(({idlNames, idlExtendedNames}) => {
               const interfaces = {...idlNames};
               Object.keys(idlExtendedNames).forEach(i => {
                 idlExtendedNames[i].forEach(ext => {
                   if (!interfaces[ext.name]) {
                     interfaces[ext.name] = {...ext};
                   } else {
                     interfaces[ext.name].members = interfaces[ext.name].members.concat(ext.members);
                   }
                 });
               });
               Object.keys(interfaces).filter(n => interfaces[n].type === "interface" && (interfaces[n].extAttrs.length === 0 || !interfaces[n].extAttrs.find(ea => ea.name === "NoInterfaceObject")))
                 .forEach(interface => {
                   const bcd = {api:{}};
                   bcd.api[interface] = {};
                   bcd.api[interface].__compat = {...bcd_skeleton};
                   bcd.api[interface].__compat.mdn_url = base_mdn_url + interface;
                   // add constructor(s) first
                   if (interfaces.extAttrs) {
                     if (interfaces.extAttrs.find(ea => ea.name === "Constructor")) {
                       bcd.api[interface][interface] = {};
                       bcd.api[interface][interface].__compat = {...bcd_skeleton};
                       bcd.api[interface][interface].__compat.mdn_url = base_mdn_url + interface + "/" + interface;
                     }
                     const namedconstructor = interfaces.extAttrs.find(ea => ea.name === "NamedConstructor");
                     if (namedconstructor) {
                       const name =namedconstructor.rhs.value;
                       bcd.api[interface][name] = {};
                       bcd.api[interface][name].__compat = {...bcd_skeleton};
                       bcd.api[interface][name].__compat.mdn_url = base_mdn_url + interface + "/" + name;
                     }
                   }
                   interfaces[interface].members.filter(m => m.name)
                     .sort(propertiesFirst)
                     .forEach(m => {
                       bcd.api[interface][m.name] = {};
                       bcd.api[interface][m.name].__compat = {...bcd_skeleton};
                       bcd.api[interface][m.name].__compat.mdn_url = base_mdn_url + interface + "/" + m.name;
                     });
                   if (existingBCD[interface]) {
                     const existing = loadBCD(existingBCD[interface]);
                     if (augmentExistingBCD(existing.api[interface], bcd.api[interface])) {
                       fs.writeFileSync(existingBCD[interface], JSON.stringify(existing, null, 2) + "\n");
                     }
                   } else {
                     fs.writeFileSync(interface + ".json", JSON.stringify(bcd, null, 2) + "\n");
                   }
                 });
             })
            );
