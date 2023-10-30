const fs = require('fs')
const prompt = require('prompt-sync')()
const path = '/Users/philsch/Desktop/DTA-RS/'

//A.1 Construire la liste des collections à partir de WD, vérifier la syntaxe et cohérence de leurs préfixes (=noms des répertoires)  
var dirNames = fs.readdirSync(path + 'Collections')
const collRE = new RegExp('^m$|^[A-Z]{2,4}$')
console.log(`Eléments du répertoire ${path}Collections ignorés: ${dirNames.filter(el => !collRE.test(el))}`)
var collNames = dirNames.filter(el => collRE.test(el))
collNames.forEach(coll1 => { //vérifier l'inter-compatibilité des préfixes
   collNames.forEach(coll2 => {
      if (coll1 != coll2 && coll2.startsWith(coll1))
         console.log("Préfixes de collections incompatibles: " + coll2 + " couvre " + coll1)
   })
})

{//A.2 mettre le tableau colls dans l'ordre définitif ("m" en tête, puis alpha)
   var i = collNames.findIndex(colName => colName == 'm')
   if (i == undefined) { console.log('répertoire m absent: abandon!'); return }
   collNames.splice(i, 1); collNames.unshift('m')  //mélodies en tête!
}
const mediaExtensions = ['jpg|pdf|png', 'mp3|mp4|m4a', 'mp4|mov']
const gold = {}
collNames.forEach(prefix => { //B)  Pour chaque nom de collection....
   function collPrompt(txt) { prompt(prefix.padEnd(6) + txt) } //erreur bloquante
   function collReport(txt) { console.log(prefix.padEnd(6) + txt) } //simple signalement

   gold[prefix] = JSON.parse(fs.readFileSync(`${path}backOffice/CollM/${prefix}.json`, 'utf8'))
   var coll = gold[prefix] //forme abrégée
   var keys = Object.keys(coll)

   //B.1 Vérifier la syntaxe des métadonnées de la collection dans son .json:
   if (!keys.includes("refs")) collReport(`pas de refs`)
   if (!keys.includes("prefix")) collPrompt('pas de prefixe')
   if (coll.prefix != prefix) collPrompt(`mauvais prefixe`)
   if (!keys.includes("media")) collReport(`pas de media`)
   else {
      if (!coll.media.match(/^([pav],)*[pav]$/)) collPrompt(`propriété media ${coll.media} mal formattée)}`)
      if (coll.media.length > 1) { //il faut donc des suffixes, vérifions-les:
         if (keys.includes("suffix")) {
            if (!coll.suffix.match(/^,([A-Z],)*[A-Z]|m$/)) collPrompt(`propriété suffix ${coll.suffix} mal formattée`)
            if (coll.suffix.length + 1 != coll.media.length) collPrompt(`propriété media ${coll.media} incompatible (en nombre) avec la propriété suffix ${coll.suffix}`)
         } else collPrompt(`media "long" sans "suffix"`)
      }
      //B.2) reformattages métadonnées pour le calcul en C), mais aussi conservés dans le gold:
      coll.suffix = (coll.suffix?.split(',') ?? [])
      coll.suffix[0] = '.'                                         // ",A,B,C" => ".,A,B,C"
      coll.media = coll.media.split(',').map(m => 'pav'.indexOf(m))  // "p,p,a,v" => "0,0,1,2"
   }
   if (!keys.includes("colldoc")) collReport(`pas de colldoc`)
   if (!keys.includes("core")) collReport(`pas de core`)

   //B.3) Vérifier la syntaxe des références (dans m et les collections)
   if (prefix == 'm') {
      kSet = new Set 
      coll.refs.forEach((ref, i) => {  // la collection "spéciale" des mélodies
         if (ref.mel != i) prompt(`m.json incohérent: ${i}e mélodie référencée ${ref.mel}!`)
         if (ref.ref) prompt(`m.json incohérent: propriété erronnée "ref" interdite pour mel ${ref.mel}`)
         Object.keys(ref).forEach(k=>kSet.add(k)) 
      })
      collReport((Array.from(kSet)).sort().join())
   } else {  //collection "normale": vérifier ordre et syntaxe des refs réelles dans .json selon méta
      var re = new RegExp((prefix == 'DS' ? '' : prefix) + coll.core)
      var oldRef = ''
      missingRefAt = []
      if (coll.refs) coll.refs.forEach((ref, i) => {
         if (ref.ref == undefined) missingRefAt.push(i)
         else {
            if (compaRef(oldRef, ref.ref) != -1) collReport(` ${ref.ref} (${i}e référence) hors séquence alphalogique dans .json.`)
            oldRef = ref.ref
            if (!re.test(ref.ref)) collReport(`${ref.ref} fails ${re}`)
         }
         if (ref?.mel >= gold.m.refs.length)
            if (prompt(`création du n° de mélodie ${ref.mel} pour ${ref.ref}(max: ${gold.m.refs.length - 1})? o/n: `) == 'o')
               gold.m.refs[ref.mel] = { "mel": ref.mel }
      })
      else console.log(`aucune référence dans ${prefix}.json`)
      if (missingRefAt.length) collReport(`rang(s) ${missingRefAt.join()} sans ref.`)
   }




   //C.1  Valider les noms de fichiers du répertoire correspondant, et noter les extensions des noms valides dans sxs et mscz 
   // (2 nouvelles propriétés de chaque doc) 
   var fNames = fs.readdirSync(path + 'Collections/' + prefix)
   fNames.sort(compaRef)//useless??
   const fNameRegEx0 = new RegExp(`^(${prefix}( Annexes| Coll[.].+|[.]json))|^([.].*)$`)
   fNames = fNames.filter(fName => !fNameRegEx0.test(fName))  //leaves out 'XX Annexes', 'XX Coll.xxx', 'XX.json', and '.*' files 
   fNames = fNames.filter(fName => {
      if (fName.startsWith(prefix)) return true
      collReport('erreur sur le préfixe de collection : ' + fName)
      return false
   })

   var sfxRegEx = []    // jeu de regExps  pour trouver les fichiers derrière chaque suffixe d'une réf 
   coll.suffix?.forEach((suffix, i) => {
      sfxRegEx[i] = new RegExp('^' + (i ? suffix : '') + '[.](' + mediaExtensions[coll.media[i]] + ')')
   })
   var refWithoutaMediaFile = []
   coll.refs.forEach((doc, i) => {
      var mscz = [] //suffixes mscz trouvés et conformes pour cette réf
      var sxs = [[], [], []] //suffixes (+ extensions) trouvés et conformes pour cette réf, pour p,a,v // peut-être une 4e col pour les mscx
      var ref = doc.ref ?? ('m' + i) //seule la coll m n'a pas de propriété "ref""
      var refLen = ref.length
      fNames = fNames.filter(fName => {
         var sufChar = fName[refLen] //finds '.' (from extension) if suffix is '' defaulted
         //c'est ici qu'on sait déjà si une URL peut être obsolète
         if (!(fName.startsWith(ref) && coll.suffix.includes(sufChar)))
            return true // core doesn't match: not for this doc
         if (fName.endsWith(".mscz")) {
            mscz.push(fName.substring(refLen, fName.length - 5))  //collecte des .mscz (sans l'extension): généralement ""
            //non-empty mscz spurs: should collect these with at least their dot ".", to cumulate in sxs[3] instead of the special mscz property
            return false //  OK, traité
         }
         if (prefix == 'm') {
            sxs[0].push(fName.substring(refLen))  //  p de pav
            // "validation des suffixes (-.{0,10})|(m(u|([1-9]?[.])?[1-9]))" à faire un jour...
            return false // OK, traité
         }
         var sufIndex = coll.suffix.findIndex(s => s == sufChar)
         if (sufIndex == -1) {
            collReport(`fichier ${fName} avec un suffixe ${sufChar} introuvable dans ${coll.suffix.join('|')}`)
            return true  //... traité, mais inclassable
         }
         if (fName.substring(refLen).match(sfxRegEx[sufIndex])) {
            var pav = coll.media[sufIndex]  // 0, 1 ou 2 pour p,a ou v
            sxs[pav].push(fName.slice(refLen))   //et si ce sxs[med] contient déjà une url??
            return false //OK, classé
         }
         else return true // pas traité par cette référence.
      })
      if (!sxs.flat().length) refWithoutaMediaFile.push(doc.ref ?? String(i)) //mettre sur la liste des refs du json sans aucun fichier media associé
      else doc.sxs = sxs.map(e => e.join()).join(';')
      if (mscz.length) doc.mscz = mscz.join()
      /* after change for non-empty mscz spurs above last 2 lines should become:
      if (sxs.flat().length + mscz.length > 0) doc.sxs = sxs.map(e => e.join()).concat(mscz.join()).join(';')
      */
   })
   if (refWithoutaMediaFile.length + fNames.length) {
      //collReport(`${refWithoutaMediaFile.length} réf${refWithoutaMediaFile.length>1 ?'s':''} dans .json sans fichier media correspondant${refWithoutaMediaFile.length ?  ' : '+refWithoutaMediaFile.join(', '):' .'}`)
      collReport(`${fNames.length} fichier${fNames.length > 1 ? 's' : ''} sans réf correspondante dans .json${fNames.length ? ' : ' + fNames.join(', ') : ' .'}`)
   } else collReport(`fichiers et réfs.json alignés`)

   //C.2  Examen des URL de la collection, et mise en obsolescence selon les fichiers trouvés
   var keys = []
   coll.refs.forEach(doc => {
      Object.keys(doc).forEach(key => {
         if (keys.indexOf(key) === -1) keys.push(key)
      })
   })
   //collReport(`clés: ${keys.join(', ')}`)
   keys.forEach(key => {
      if (key.startsWith('url')) {
         if (key.length > 4) {
            collPrompt(' En-tête ' + key + ' interdit: nom trop long')
            return
         }
         var suffChar = (key.length > 3 ? key[3] : '.')
         if (!coll.suffix.includes(suffChar)) {
            collPrompt('url: suffixe: ' + suffChar + ' manquant en métadonnées de la collection (suffix = ' + coll.suffix + ')')
            return
         }
         if (!coll.hasOwnProperty(key + 'Pref')) {
            collPrompt(' métadonnée ' + key + 'Pref' + ' manquante.')
            return
         }
         var pav = coll.media[coll.suffix.findIndex(s => s == suffChar)]  // média associé à cette url par les métadonnées de coll
         //vérifier que chaque doc qui a une url avec cette clé n'a pas déjà un fichier associé:
         coll.refs.forEach(doc => {
            if (doc.hasOwnProperty(key)) {
               var sxs = doc?.sxs?.split(';')?.map(x => x.split(',').filter(y => y != '')) ?? [[], [], []]
               if ((fileNameEnding = sxs[pav].find(x => x[0] == suffChar)) != undefined) {
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
})


//D.1 déploiement/check de mel.ds et création du lien inverse dans DS  
gold.DS.refs.forEach(d => d.mels = [])
gold.m.refs.forEach((mel, i) => {
   if (mel.ds != undefined) {//remplacer "ds" par l'index dans la liste des ds et indexer la mél dans la ds
      mel.ds = mel.ds.split(',')
      mel.ds.forEach(d => {
         if (d>=gold.DS.refs.length) prompt(`m.json incohérent avec ds.json: mel ${i} a une ds inconnue "${ds}".`)
         else gold.DS.refs[d].mels.push(i)
      })
   }
})

//D.2 Recherche de références ds redondantes dans m (compare mel.ds avec dansesHeritees(mel))

function dsHeritage(mel) { return //mel: objet, returns an array of danse numbers
      Array.from(new Set(ancestors(mel).reduce((acc, m ) => m?.ds ? acc.concat(m.ds) : acc, [])))}
function parents(mel) { return //mel :objet, returns an array of mel objects
      mel?.graph?.rel.split('').reduce((acc, char, i) => char=='p' ? acc.concat([i]) : acc, [])
   .map(i=>graph[mel.graph.grp].mels[i]) || []}
function ancestors (mel) { return//mel :objet, returns an array of mel objects
      (Array.from(new Set(parents(mel).reduce((acc, par)=> acc.concat(ancestors(par)), parents(mel)))))}

gold.m.refs.forEach((mel, i) => {
   dh=dsHeritage(mel)
   mel?.ds??[].filter(d=>dh.includes(d)).forEach(dup => {
      if (prompt(`mel ${i}.ds déclare (mais hérite déjà) de ${gold.DS.refs[dup].ref} de ses ancêtres): corriger (o/n)?`)=='o')
          mel.ds = mel.ds.filter(d != dup)
   })
})

//D3 : graphes : ventilation des données de graphe vers m.refs  et réciproque
gold.m.graphs.forEach((g, i) => g.forEach(m => {
   if (m.grp) {
      var otherGraph = gold.m.graphs.findIndex(g=>g.includes(m.grp))
      prompt(`m.json incohérent: mel${m.mel} appears both in graphs ${i} and ${otherGraph}.`)
   } else m.grp = g
   if (i) gold.m.refs[m.mel].graph = m  
}))

//D4 : ajout de relations (et melodies) par l'Utilisateur
//pour la portabilité du code qui suit, je cherche  
//la similitude parfaite des structure et nommages de données dans gold.m.refs et gold.m. graph


function stringMark(rel, index, char) { 
   var arr=rel.split('')
   arr.splice(index,1,char); 
   return arr.join('')
 }

 function setRel(par, enf, sim) { //prérequis: même graphe!  //sim = opt boolean (not tested yet)
   var e ='e', p ='p'
   if (sim) { e = 's'; p = 's'}
   par.graph.rel = stringMark(par.graph.rel, enf.graph.rel.indexOf("m"), e )
   enf.graph.rel = stringMark(enf.graph.rel, par.graph.rel.indexOf("m"), p )
 }

do { 
   var newMel = gold.m.refs.length
   var input
   function melInput(role) {//renvoie objet et n° des mélodies et familles enfant et parent
      var num
      while ((num = prompt(`n° de mélodie ${role} ? `)) >= newMel) {
         console.log("numéro de mél trop élevé")
      }
      if (num == '') return [undefined, undefined]
      var m = gold.m.refs[num]
      console.log (JSON.stringify(m, ["mel", "music", "rel"], 2))
      return [m, m?.graph?.grp ?? gold.m.graphs[0]]  
   }
   switch (input = prompt(`créer une nouvelle mélodie m${gold.m.refs.length} (m), une nouvelle relation (r) ou sauter cette étape ()?`)) {
      case 'm':
         gold.m.refs[newMel] = { "mel": newMel }
         if (input = prompt(`commentaire pour m${newMel}?`)) gold.m.refs[newMel].commentaire = input
         if (input = prompt(`musique en ABC pour m${newMel}?`)) gold.m.refs[newMel].music = input
         break
      case 'r': 
         var [par, pGrp] = melInput('parente (utilisée)')
         var [enf, eGrp] = melInput('enfant (utilisante)')
         if (pGrp == eGrp) { 
            if (pGrp[0]?.rel ?? false) {       //CAS 1: il sont tous deux célibataires, il faut faire une nouvelle famille
                //new family number
               var nGrp =[]
               gold.m.graphs.push(nGrp)
               nGrp.push(par.graph = { mel: par.mel, X: 60, Y: 30, rel: "me", grp:nGrp })
               nGrp.push(enf.graph = { mel: enf.mel, X: 80, Y: 80, rel: "pm", grp:nGrp })
            } 
            else setRel(par, enf)   //CAS 2: simple màj de la table des rels du graphe
         } 
         else if ((pGrp[0]?.rel ?? false )||( eGrp[0]?.rel ?? false)) { //CAS 3 , faut rattacher la mélodie solitaire mS à la famille f
              //anonymisation des mélodies : SOLitaire (avant) ou GREgaire et du groupe de Destination
            var [sol, gre, dGrp] = (pGrp[0]?.rel ?? false) ? [enf, par, pGrp] : [par,enf, eGrp]
            var newsoli = gold.m.graphs[0].findIndex(i=>i.mel == sol.mel)//index de sol dans 0, sa pseudo-famille d'origine
            gold.m.graphs[0].splice(newsoli, 1) //on sort le solitaire de sa liste du graph[0]
            var j = gre.graph.rel.indexOf('m') //position de gre dans son groupe (Destination de sol)
            dGrp.forEach((m,i) => m.rel += (i==j?(gre==par? 'e':'p'):'.')) //on rallonge chaque ligne du groupe
            dGrp.push(sol.graph = {                                  //on ajoute la nouvelle ligne})
               mel: sol.mel, X: 60 + (Math.floor(Math.random() *30)), Y: 30+ (Math.floor(Math.random() *30)),
               rel: ('.'.repeat(j) + (gre==par ? 'p' : 'e')).padEnd(dGrp.length, '.') + 'm' 
            })
            console.log(dGrp)
         } else {                   //CAS 4 : 2 familles non vides à merger!convention: on garde la famille du parent
            //complète le graphe
            var newLength = pGrp.length + eGrp.length  
            offsetX = pGrp.reduce((max, m) => Math.max(m.graph.X, max), 0)
            offsetY = pGrp.reduce((max, m) => Math.max(m.graph.Y, max), 0)
            pGrp.forEach(m=>m.rel.padEnd(newLength, '.'))
            eGrp.forEach(m=>{
               m.X +=offsetX
               m.Y +=offsetY
               m.rel.padStart(newLength, '.')
            })
            pGrp.concat(eGrp)
            setRel(par, enf)
            gold.m.graphs.splice(gold.m.graphs.indexOf(eGrp),1)  //on libère le groupe vide (pour ne pas laisser [] traîner?)
         }
         //console.log (par)
         //console.log (enf)
      }
} while (input != '')

console.log(`${gold.m.graphs.length} graphes pour m.js:`)


if (prompt("enregistrer m.graphs.json o/n? (défaut: oui) ") !='n')
fs.writeFileSync(path + "m.graphs.json", JSON.stringify(gold.m.graphs, ["mel","X","Y","rel"], 2), (err) => {
   if (err) throw err;
})

//enregistrer le gold

function replacer(key, value) { // Filtering out properties for JSON.stringify of colls
   switch (key) {
      case 'ds':
      case 'suffix':
      case 'mels':                       //dans DS [et m.fam]
      case 'media': return value?.join()  //break inutile car "return"
      case 'graph' : return undefined
      case 'grp' : return undefined
      default: return value;
   }
}
if (prompt("enregistrer gold.js o/n? (défaut: oui) ") !='n')
   fs.writeFileSync(path + "gold.json", JSON.stringify(gold, replacer, 4), (err) => {
      if (err) throw err;
   })


//library...
//to compare references when syntax forbids trailing zeroes in numeric segments
function compaRef(a, b) {
   function alignDigits(ref) { return ref.replaceAll(/(\d+)/g, function (match) { return match.padStart(4, '0') }) }
   let sortVal = compare(alignDigits(String(a)), alignDigits(String(b)))
   if (sortVal == 0) console.log(`-------- Référence double: ${a}, ${b} `)
   return sortVal
}
function compare(a, b) { if (a < b) return -1; if (a > b) return 1; return 0 }
