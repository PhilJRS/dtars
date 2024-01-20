import fetch from 'node-fetch'
import { parseFromString } from 'dom-parser'
import ftp from 'basic-ftp'
import fs from 'fs'
import prompt from 'prompt-sync'
var fNames = []
var gold
 
const localPath = '/Users/philsch/Desktop/DTA-RS/'



fetch("https://www.dta.philiole.fr/gold.json").then(resp => {resp.json().then(data => {
    gold = data
    var prefixes
    var processed = 0
    listDirectory('', ()=>{  //expecting subdirs, thus ending in '/'
        prefixes = sortedFiltereCollNames(fNames)
        prefixes.forEach((prefix, i) => { //compare collection names with gold's list
            if (Object.keys(gold)[i] != prefix) 
               console.log(`object #${i} name ${prefix} in sorted Collection subfolders differs from object #${i} in gold : ${Object.keys(gold)[i]} `)
        }) 
        prefixes.forEach(prefix => listDirectory(prefix, ()=>{
            checkCollection(prefix)
            processed ++
            if (processed == prefixes.length) { //c'était la dernière coll, donc on enregistre le nouveau gold.json:
                //if (prompt('enregistrer gold.js localement o/n') == 'o') {
                   fs.writeFileSync(localPath + 'gold.json', JSON.stringify(gold, null, 4), (err) => {
                      if (err) throw err;
                   })
                   //if (prompt('enregistrer gold.js sur OVH o/n?') == 'o') 
                      writeGoldToServer()
                //   else console.log("enregistrement sur OVH non demandé")
                //} else console.log("pas d'enregistrement ( ni local ni sur OVH)")
             }
        }))
})})})


function listDirectory(prefix, callbackFn) {
    const serverUrlBase = 'https://www.dta.philiole.fr/Collections/'
    fetch(serverUrlBase+ (prefix ? prefix+'/' : '')).then(res => {
        res.text().then(html_0 => {
            const html = html_0.slice(56) // skips <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
            //console.log(html)
            const dom = parseFromString(html);
            var myList =  dom.getElementsByTagName('pre')[0].childNodes
            var fNameNode = 16 //first dom node with useful (file- or) subdirectory name
            //et pour ceux qui n'ont rien (<16)??
            fNames = [] 
            if (myList.length > fNameNode) do {
                fNames.push(
                    myList[fNameNode].attributes[0].value
                    //, myList[fNameNode +1 ].text.slice(0,-5).trim()  //=>dates
                )
            } while ((fNameNode += 4) < myList.length)
            callbackFn()
        })
    })
}

function sortedFiltereCollNames(fNames) {
    //A.1 vérifier la syntaxe et cohérence de leurs préfixes (=noms des répertoires, reçus avec un avec / final)
    const collRE = new RegExp('(^m|[A-Z]{2,4})\/$')
    var dirt = fNames.filter(el => !collRE.test(el))
    if (dirt.length) console.log(`Eléments étrangers à ${collRE} dans le répertoire Collections : ${dirt}`)
    var collNames = fNames.filter(el => collRE.test(el)).map(el=>el.slice(0,-1))
    collNames.forEach(c1 => collNames.forEach(c2 => { if (c1 != c2 && c2.startsWith(c1))
       console.log("Préfixes de collections incompatibles: " + c2 + " couvre " + c1)
    }))
    //A.2 mettre le tableau colls dans l'ordre définitif ("m" en tête, puis alpha)
    var i = collNames.findIndex(colName => colName == 'm')
    if (i == undefined) { console.log('répertoire m absent: abandon!'); return }
    collNames.splice(i, 1); collNames.unshift('m')  //mélodies en tête!++
    console.log(`Collections : ${collNames}`)
    return collNames
}

function checkCollection(prefix) {
    function collPrompt(txt) { prompt(prefix.padEnd(6) + txt) } //erreur bloquante
    function collReport(txt) { console.log(prefix.padEnd(6) + txt) } //simple signalement
    var coll = gold[prefix] //forme abrégée
    var keys = Object.keys(coll)
 
    //B.0 nettoyage des sxs:
    coll.refs.forEach(mel=>{if (mel?.sxs ) mel.sxs  = undefined })
 
    //B.1 Vérifier la syntaxe des métadonnées de la collection dans son .json:
    if (!keys.includes("refs")) collReport(`pas de refs`)
    if (!keys.includes("prefix")) collPrompt('pas de prefixe')
    if (coll.prefix != prefix) collPrompt(`mauvais prefixe`)
    if (!keys.includes("media")) collReport(`pas de media`)
    else {
       if (!coll.media.match(/^([0-2],)*[0-2]$/)) collPrompt(`propriété media ${coll.media} mal formattée`)      
       if (coll.media.length > 1) { //il faut donc des suffixes, vérifions-les:
          if (keys.includes("suffix")) {
             if (!coll.suffix.match(/^[.],([A-Z],)*[A-Z]|m$/)) collPrompt(`propriété suffix ${coll.suffix} mal formattée`)
             if (coll.suffix.length != (coll?.media.length ?? 0)) collPrompt(`propriété media ${coll.media} incompatible (en nombre) avec la propriété suffix ${coll.suffix}`)
          } else collPrompt(`media "long" sans "suffix"`)
       }
       //B.2) reformattage suffix pour le calcul en C),reformatté dans le gold:
       coll.suffix = (coll.suffix?.split(',') ?? [])   // ".,A,B,C" =>['.', 'A', 'B', 'C']
    }
    if (!keys.includes("colldoc")) collReport(`pas de colldoc`)
    if (!keys.includes("core")) collReport(`pas de core`)
 
    //B.3) Vérifier la syntaxe des références (dans m et les collections)
    if (prefix == 'm') {
       var kSet = new Set 
       coll.refs.forEach((ref, i) => {  // la collection "spéciale" des mélodies
          if (ref.mel != i) prompt(`m.json incohérent: ${i}e mélodie référencée ${ref.mel}!`)
          Object.keys(ref).forEach(k=>kSet.add(k)) 
       })
       collReport((Array.from(kSet)).sort().join())
    } else {  //collection "normale": vérifier ordre et syntaxe des refs réelles dans .json selon méta
       var re = new RegExp((prefix == 'DS' ? '' : prefix) + coll.core)
       var oldRef = ''
       var missingRefAt = []
       if (coll.refs) coll.refs.forEach((ref, i) => {
          if (ref.ref == undefined) missingRefAt.push(i)
          else {
             if (!re.test(ref.ref)) collReport(`${ref.ref} fails ${re}`)
             if (compaRef(oldRef, ref.ref) != -1) collReport(` ${ref.ref} (${i}e référence) hors séquence alphalogique dans .json.`)
             oldRef = ref.ref
          }
          if (ref?.mel >= gold.m.refs.length)
             if (prompt(`création du n° de mélodie ${ref.mel} pour ${ref.ref}(max: ${gold.m.refs.length - 1})? o/n: `) == 'o')
                gold.m.refs[ref.mel] = { "mel": ref.mel }
       })
       else console.log(`aucune référence dans ${prefix}.json`)
       if (missingRefAt.length) collReport(`rang(s) ${missingRefAt.join()} sans ref.`)
    }
    //C.1  Valider les noms de fichiers du répertoire correspondant, et noter les extensions des noms valides dans sxs
    fNames.sort(compaRef)//useless??
    const fNameRegEx0 = new RegExp(`^(${prefix}( Annexes| Coll[.].+|[.]json))|^([.].*)$`)
    fNames = fNames.filter(fName => !fNameRegEx0.test(fName))  //leaves out 'XX Annexes', 'XX Coll.xxx', 'XX.json', and '.*' files 
    fNames = fNames.filter(fName => {
       if (fName.startsWith(prefix)) return true
       collReport('erreur sur le préfixe de collection : ' + fName)
       return false
    })
    
 
    var sfxRegEx =    []    // jeu de regExps  pour trouver les fichiers derrière chaque suffixe d'une réf
    const mediaExtensions = ['jpg|pdf|png', 'mp3|mp4|m4a', 'mp4|mov']
    coll.suffix?.forEach((suffix, i) => {
       sfxRegEx[i] = new RegExp('^' + (i ? suffix : '') + '[.](' + mediaExtensions[coll.media.split(',')[i]] + ')')
    })
    var refWithoutaMediaFile = []
    coll.refs.forEach((doc, i) => {
       var sxs = [[], [], [], []] //suffixes (+ extensions) trouvés et conformes pour cette réf, pour p,a,v // peut-être une 4e col pour les mscx
       var ref = doc.ref ?? ('m' + i) //seule la coll m n'a pas de propriété "ref""
       var refLen = ref.length
       fNames = fNames.filter(fName => {
          var sufChar = fName[refLen] //finds '.' (from extension) if suffix is '' defaulted
          //c'est ici qu'on sait déjà si une URL peut être obsolète
          if (!(fName.startsWith(ref) && coll.suffix.includes(sufChar)))
             return true // core doesn't match: not for this doc
          if (fName.endsWith(".mscz")) 
             if (fName!=ref+".mscz") return true
             else {
                sxs[3].push(".")  // collecte des .mscz
                return false //  OK, traité
          }
          if (prefix == 'm') {
             sxs[0].push(fName.substring(refLen))  //  p de pav
             // "validation des suffixes (-.{0,10})|(m(u|([1-9]?[.])?[1-9]))" à faire un jour...
             return false // OK, traité
          }
          var sufIndex = coll.suffix.findIndex(s => s == sufChar)  //cherchons les extensions (.xxx) autorisées pour ce suffixe dans cette coll
          if (sufIndex == -1) {
             collReport(`fichier ${fName} avec un suffixe ${sufChar} introuvable dans ${coll.suffix.join('|')}`)
             return true  //... traité, mais inclassable
          }
          if (fName.substring(refLen).match(sfxRegEx[sufIndex])) {
             var pav = coll.media.split(',')[sufIndex]  // 0, 1 ou 2 pour p,a ou v
             sxs[pav].push(fName.slice(refLen))   //et si ce sxs[med] contient déjà une url??
             return false //OK, classé
          }
          else return true // pas traité par cette référence.
       })
       if (!sxs.flat().length) {
             refWithoutaMediaFile.push(doc.ref ?? String(i)) //mettre sur la liste des refs du json sans aucun fichier media associé
             doc.sxs = undefined
       }
       else doc.sxs = sxs.map(e => e.join()).join(';')
    })
    if (refWithoutaMediaFile.length + fNames.length) {
       //collReport(`${refWithoutaMediaFile.length} réf${refWithoutaMediaFile.length>1 ?'s':''} dans .json sans fichier media correspondant${refWithoutaMediaFile.length ?  ' : '+refWithoutaMediaFile.join(', '):' .'}`)
       if (fNames.length) collReport(`${fNames.length} fichier${fNames.length > 1 ? 's' : ''} sans réf correspondante dans .json${fNames.length ? ' : ' + fNames.join(', ') : ' .'}`)
    } //else collReport(`fichiers et réfs.json alignés`)
 
    //C.2  Examen des URL de la collection, et mise en obsolescence selon les fichiers trouvés
    var keys = []  //liste des colonnes du tableau
    coll.refs.forEach(ref => 
       Object.keys(ref).forEach(key => {if (!keys.includes(key)) keys.push(key)}))
    //collReport(`clés: ${keys.join(', ')}`)
    keys.forEach(key => {
       if (key.startsWith('url')) {
          if (key.length > 4) {
             collPrompt(' En-tête ' + key + ' interdit: nom trop long')
             return
          }
          var suffChar = (key.length > 3 ? key[3] : '.')
          if (!coll.suffix.includes(suffChar)) {
             collPrompt('url: suffixe: ' + suffChar + ' manquant en métadonnées de la collection (suffix = ' + coll.suffix.join() + ')')
             return
          }
          if (!coll.hasOwnProperty(key + 'Pref')) {
             collPrompt(' métadonnée ' + key + 'Pref' + ' manquante.')
             return
          }
          var pav = coll.media.split(',')[coll.suffix.findIndex(s => s == suffChar)]  // média associé à cette url par les métadonnées de coll
          //vérifier que chaque doc qui a une url avec cette clé n'a pas déjà un fichier associé:
          coll.refs.forEach(doc => {
             if (doc.hasOwnProperty(key)) {
                var sxs = doc?.sxs?.split(';')?.map(x => x.split(',').filter(y => y != '')) ?? [[], [], []]
                var fileNameEnding = sxs[pav].find(x => x[0] == suffChar)
                if (fileNameEnding != undefined) {
                   collPrompt(doc.ref + fileNameEnding + ' existe déja, donc ' + key + ' reste ignoré pour cette référence')
                   doc[key] = undefined //on expurge le gold de cette URL
                } else {
                   sxs[pav].push((suffChar == '.' ? '' : suffChar) + '.url')                //mettre la trace dans sxs
                   doc.sxs = sxs.map(e => e.join()).join(';')   //et replier le tout
                }
             }
          })
       }
    })
    if (coll.suffix) coll.suffix = coll.suffix.join()
    function compaRef(a, b) { //to sort refs since syntax forbids trailing zeroes in numeric segments
       function compare(a, b) { if (a < b) return -1; if (a > b) return 1; return 0 }
       function alignDigits(ref) { return ref.replaceAll(/(\d+)/g, function (match) { return match.padStart(4, '0') }) }
       let sortVal = compare(alignDigits(String(a)), alignDigits(String(b)))
       if (sortVal == 0) console.log(`-------- Référence double: ${a}, ${b} `)
       return sortVal
    }
}

async function writeGoldToServer() {
   const writeKeys=JSON.parse(fs.readFileSync(`writeKeys.json`, 'utf8'))
   const client = new ftp.Client()
   client.ftp.verbose = false
   try {
      await client.access(writeKeys)
      await client.uploadFrom(localPath + "gold.json", "dta/gold.json" )
   } catch(err) {
      console.log(err)
   }
   finally {
      client.close()
      console.log("enregistré sur le serveur")
   }
}
