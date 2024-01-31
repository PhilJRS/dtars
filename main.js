var 
  gold, flatColls, prefixes, dico, dicoArr, collPrfx, graphs,
  col = [], 
  mels = [],
  flatCollFirst=[0],
  curColNb = null,
  curMelNb = null,
  dansesCumReport

const 
  separatorRegEx = /_| |-|, |'/,
  urlHeadG = 'https://docs.google.com/document/d/',
  urlHeadC = 'https://dta.philiole.fr/Collections/'

window.onload = function() {
  $.get("gold.json", function(goldFile) {
    gold = goldFile
    flatColls = Object.values(gold).flatMap(x => x.refs) //index direct sur les (3000+) réfs 
    prefixes = Object.keys(gold) 
    mels = gold.m.refs
    document.querySelector('#DTstats').textContent = "DTA-RS : "
      +mels.length+ " mélodies, "
      +flatColls.reduce((acc, cur) => acc + ((cur?.sxs?.replaceAll(';',',').split(',').filter(e=>e.length>0).length) ?? 0),0) 
      + " documents, " +Object.keys(flatColls).length +" références, "
      +prefixes.length +" collections."
    //tableau des premiers indices de chaque coll dans flatColl:
    prefixes.forEach((prefix, i) => {
      flatCollFirst[i+1] = flatCollFirst[i]+gold[prefix].refs.length
      col[i] = gold[prefix]
    })
    
    gold.DS.refs.forEach(d => d.mels = []) // création du lien inverse dans DS 
    mels.forEach((mel, i) => {  //expansions des listes de non-docs   //deréférencement souhaitable?
      initGraphMel(mel)
      if (mel.hasOwnProperty('ds')) {
        mel.ds = mel.ds.split(",").map(d=>Number(d))
        mel.ds.forEach(d => {
          if (d>=gold.DS.refs.length) prompt(`m.json incohérent avec ds.json: mel ${i} a une ds inconnue "${ds}".`)
          else gold.DS.refs[d].mels.push(i)
       })
      }
      if (mel.hasOwnProperty('sxs')) mel.sxs = mel.sxs.split(";")
      //if (mel.hasOwnProperty('titre')) mel.tit = mel.titre.split("_")   //expansion de la liste des titres "manquants" de la mel
    })

    Object.keys(gold).forEach(pfx => makeDTradioBttn('Coll', pfx , docTable))
    initGraph()
    Object.keys(gold).forEach((prefix,i) => {  //création des liens mél -> doc et docs->cols
      switch(prefix) {
        case 'm': break
        default : // ne s'applique donc pas aux m ci-dessus) 
          gold[prefix].refs.forEach(doc => {
            doc.col=i  //reboucle le N° de collection dans les docs
            if (doc.hasOwnProperty('sxs')) doc.sxs = doc.sxs.split(";")
            if (doc.hasOwnProperty('mel')) {  //si document associé à une mel
              if (doc.mel > mels.length -1) console.log('mel '+doc.mel+' non-existante mentionnée par '+doc.ref)
              else { 
                mels[doc.mel].docs ??= []     //éventuelle initialisation de la table
                mels[doc.mel].docs.push(doc)  //association mel -> doc  
          }}})
          break
    }})
    
    //construction du Dico  //devra se faire côté serveur? 
   dico = []
   flatColls.forEach((doc, i) => {
      if (doc.hasOwnProperty('mel')) {  //attention dans la collection m
        ref = (i<mels.length ? i : doc.mel)
        //collecter les gMotsClés pour la mel en question
        if(!(mels[ref].gMotsClés)) mels[ref].gMotsClés = ""
        if (doc.titre) {
          var b = keyWordsArr(doc.titre, separatorRegEx)
          var c = b.concat(mels[ref].gMotsClés.split(' '))
          mels[ref].gMotsClés = Array.from(new Set(c)).join(' ')
      }}
      else ref = i
      var titreEtRef = (doc.titre ?? '' )+'_'+(doc.ref ?? '') //toutes les refs sont aussi dans le dico, y compris les noms des danses (refs DS)
      var motsClés = Array.from(new Set(keyWordsArr(titreEtRef, separatorRegEx)))   //ensures uniqueness (and sort)
      if (i<mels.length) motsClés.push('m'+i) //on ajoute les n° de mels, même les 10 qui n'ont que 2 caractères!
      motsClés.forEach(mot => {
        j = dico.findIndex(el => el.mot >= mot)
        if (j==-1)  dico.push(new DicoWord(mot, ref)) //mot nouveau à ajouter en fin de liste
        else if (dico[j].mot==mot)   //mot connu
          if (dico[j].refs.includes(ref)) {} else dico[j].addRef(ref)  
          else dico.splice(j, 0, new DicoWord(mot, ref)) //mot nouveau à placer avant i
    })})
    //console.log(JSON.stringify(dico,null,2))
    //console.log(Array.from(mels, mel => mel.gMotsClés))
    dicoArr = Array.from(dico, (dicoWord) => dicoWord.mot)
    autocomplete(document.getElementById("saisieMot"), dicoArr); 
    showMelPanel(234) //défaut: Fam1 (avant: défaut 75 salamandre
})}
  
//réduit une suite de mots-clés (séparés par des blancs) "kwrds" en eliminant les mots des titres "titles" :
function keyWordsArr(input, regEx){
  var a = input.toLowerCase().replaceAll('(','').replaceAll(')','').split(regEx)
  return a.filter(word => word.length > 2)
}
function unMentioned (kwrds, titles) {
  var keyWords = kwrds.split(' ')
  var titleWords = keyWordsArr(titles, separatorRegEx).split(' ')  //retourne une Array (avec redondances possibles)
  titleWords.split(' ').forEach (word=> {//if word in grapwords, remove it from grapWords
      i== (keyWords.findIndex(w == word))
      if(i>=0) keyWords.splice(i, 1)
  })
  return keyWords.join(' ') //contenu réduit par les mots des titres en param
}

class DicoWord {
  constructor(mot, flatRef) {
    this.mot = mot;
    this.refs = [flatRef];
  }
  addRef(flatRef) {
    this.refs.push(flatRef)
  }
}
function makeDTradioBttn( type, lbl, drawFunction ) {   //  type: "Coll" ou "Graph"
  var butId = 'Bt'+type+lbl
  var panel = $('#'+type+'Panel')
  $('#DT'+type+'Bttns').append($('<button id="'+butId+'"/>').text(lbl))
  $('#'+butId).click(() => {
    var previous_lbl = panel?.attr('dt_label')  // this attribute is set either here or by (docTable() or showGraph())
    if (previous_lbl == lbl) {                         // c'est une demande de masquage du panneau
      $('#'+butId).css("backgroundColor","gainsboro")  //nettoyage bouton
      panel.attr('dt_label', null) 
      if (type=='Graph' ) panel.empty().height("0px") 
      else {
        $('#cTbl').empty() //il faudrait probablement fusionner cTbl et CollPanel
        panel.hide()        //et homogénéiser ces actions de reset du CollPanel
      } 
    } else {
      if (previous_lbl) $('#Bt'+type+previous_lbl).css("backgroundColor", "gainsboro")  //nettoyage bouton
      drawFunction(lbl)
 }})}


function audioEnded() {
  console.log("audio ended")
}

function playAV(s, doc) { // comparer à toggleMel()
  if (s==null) {
    $('#AudPanel')[0].pause()
    $('#AudPanel').attr("mel",undefined).attr("src", undefined)
    $('#AudTitre').text("")
    return
  }
  var nouvTitre = doc.ref+(s.label.length==1 ? s.label : '')
  if ($('#AudTitre').text()==nouvTitre && $('#AudPanel')[0].paused ==false)
    $('#AudPanel')[0].pause()
  else {
    if (doc.mel != $('#MelPanel').attr('dt_label')) { 
      showMelPanel(doc.mel)  //laisse passer "null" (showMelPanel cachera le MelPanel s'il le faut)
    }
    $('#AudPanel').attr("mel",doc.mel)
    $('#AudPanel').attr("src", s.address)
    $('#AudTitre').text(nouvTitre)
  }
}

function saveColl_m() {  //un sous-gold! (ne sauve que la coll "m"   :  suffit tand qu'on n'édite (ne commente?) pas les vraies collections...)
  var edited_m_jsonFile=JSON.stringify(
    { refs: mels.map(m=>(Object.assign(
      {
        mel: m.mel,
        ds: m?.ds?.join(),
        titre: m.titre,
        music: m.music,
        commentaire: m.commentaire,
        //docs: m?.docs?.map(d=>d.ref).join()
        sxs: m?.sxs?.join(),
        mscz: m.mscz
      }, 
      m.f.f? {
        f: m.f.f,
        X: m.X, 
        Y: m.Y, 
        rel: m.rel
      }:{}))),
      prefix: 'm',
      name: 'Mélodies',
      core: '[0-9]{1,3}',
      suffix: ',m',
      media: '0,0',
      colldoc: '1XwAzAO4ltdPSggO5ZX38d9YiCJbL_h54OhtxDWd0D2c'
    }
  , null, "  ")
  console.log(edited_m_jsonFile)
  alert(`updated "m" json object available in console`)
  $('#saveBtn').hide()
}

function showMelPanel(j) {   // param: j :  soit "null", soit un n°de mel soit un n° de doc (si > à  mels.length)
  $('#MelPanel').attr('dt_label', null).empty()  //n'y a-t-il pas besoin de cette mémoire pour limiter un refresh inutile?
  if (j != null) {
    var dcfa = 0  // means "Doc Chosen For Audio" (valid only if >=  mels.length)
    if (j >= mels.length) {  //c'est un doc, pas un n° de mélodie ...
        if (j>=flatColls.length) {console.log("n° de doc doit être < "+flatColls.length); return }
        var doc = flatColls[j]
        if (doc.sxs[1]?.split(',')[0]) dcfa = doc // s'il a un audio non nul, il faut le jouer
        j= doc.mel //j est donc maintenant un n° de mel ( < à  mels.length)
    }  
    var mel = flatColls[j]
    $('#MelPanel').attr('dt_label', j).append($('<tr/>').append($('<table id="hdrTab" />'))) // name="M'+j+'"  ne sert à rien?
    $('#hdrTab').append($('<div id="mel"/>').html('Mélodie '+j))
    var fam = mel.f.f  //peut être 0
    refreshGraphPanelForMel(j)
    if (fam) {  //ya dla famille!
        mel?.shapes?.first()?.stroke({width:3})//=HighlightOn(j)
        $('#hdrTab').append($('<div id="famDv"/>').append($('<button id="famBt"/>').text( 'fam '+fam)))
        $('#famBt').click(()=>$('#BtGraph'+fam).click())
        addButtons('par'); addButtons('enf'); addButtons('sim')
        function addButtons(key) {  //returns a string of button elements labelled with key and values in Array mel[]
          var relMels =  mel.f.filter((_m,i)=>mel.rel[i]==key[0]).map(m=>m.mel) 
          if (relMels.length==0) return
          if (relMels.length==1) $('#famDv').append($('<button id="'+key+'Bt0"/>').text(key+' '+relMels[0]))
          else {
            $('#famDv').append($('<div/>').text(key+': '))
            relMels.forEach((el, j) => {$('#famDv').append($('<button id="'+key+'Bt'+j+'"/>').text(el))})
          }
          relMels.forEach((el, j) => document.querySelector('#'+key+'Bt'+j).addEventListener('click', function() {showMelPanel(el)}))
        }
    }
    if (mel.titre != undefined) $('#hdrTab').append($('<div/>').html('titre add: '+mel.titre.replaceAll('_','<br>')))
    if (mel.sxs != undefined) {
      if (mel.sxs[3] != "" &&  $('#msczOptions')[0].checked) $('#hdrTab').append($('<div/>').text('m'+mel.mel+'.mscz'))
      $('#MelPanel').append($('<tr/>').append($('<table id="scores"/>')))
      mel.sxs[0].split(',').forEach((sx, i) => { //seulement pour les mini-partitions niveau mélodie
        if (sx.endsWith('.png')) {
          var suffix = sx.substring(0, sx.length-4);
          $('#scores').append($('<tr id="melRow'+i+'"/>'))
          $('#scoRow'+i).append($('<td/>').text(suffix))
          $('#scoRow'+i).append($('<td/>').html('<img src='+urlHeadC+'m/m'+j+sx+' style="width:600px;height:40px;">'))
      }}) 
    }

    if (dcfa) $('#AudPanel')[0].pause() // s'il y a un doc audio à jouer en priorité
    else {
      var audioDocs = mel.docs?.filter(d=>(d.sxs!= undefined  && d.sxs[1]!=''))
      if (audioDocs?.length) dcfa = audioDocs[Math.floor(Math.random()*audioDocs.length)]
    } 

    $('#MelPanel').append($('<td/>').text(mel.music)) //plante probablement si music de type []
    $('#MelPanel').append($('<td/>').text(mel.comment))

    function dsHeritage(mel) {  //mel: object, returns an array of danse numbers
      return  Array.from(new Set(ancestors(mel).reduce((acc, m ) => mels[m.mel]?.ds ? acc.concat(mels[m.mel].ds) : acc, [])))
      function ancestors (mel) { //mel :object, returns an array of mel objects
        return (Array.from(new Set(parents(mel).reduce((acc, par)=> acc.concat(ancestors(par)), parents(mel)))))
        function parents(mel) {  //mel :object, returns an array of mel objects
          return (mel?.rel?.split('').reduce((acc, char, i) => char=='p' ? acc.concat([i]) : acc, []).map(i=>graphs[fam][i])) || []
        }
      }
    } 
    var dh =  fam ? dsHeritage(mel) : []
    if (mel.ds || dh.length) {
      $('#MelPanel').append($('<tr/>').append($('<table id="dsTab"/>')))
      if (mel.ds != undefined) {
        if ((dups = mel.ds.filter(d=>dh.includes(d))).length) {
          dups.forEach(dup => { 
            console.log(`mel ${mel.mel}.ds déclare (mais hérite déjà de) ${gold.DS.refs[dup].ref}`)
            mel.ds = mel.ds.filter(d => d != dup)
            gold.DS.refs[dup].mels = gold.DS.refs[dup].mels.filter(m => m != mel)
          })
          saveColl_m()
        }
        if (mel.ds.length) $('#dsTab').append($('<div/>').html('Danses propres: '+dsLinks(mel.ds)))
      }
      if (dh.length) $('#dsTab').append($('<div/>').html('Danses héritées: '+dsLinks(dh)))
    }
    function dsLinks(dsArr) {  
      links=[]
      dsArr.forEach(el => links.push('<a href="'+gold.DS.urlPref + gold.DS.refs[el].url+'">' // doc or spreadsheet
          +gold.DS.refs[el].ref.substring(2)+' </a>'))
      return links.join(', ')
    }

    if ($('#AudPanel').attr("mel")!=j ) playAV(null) //reset éventuel de l'audio
    if (mel.docs?.length ?? 0) {
      $('#MelPanel').append($('<tr/>').append($('<table id="mTbl"/>')))
      docTable(j, dcfa)
    }  
  } 
  refreshGraphPanelForMel(j)
}

function docTable(topRef, dcfa) {  //topRef= n° de mél ou préfixe de coll
  var cm = isNaN(topRef) ? 'c' : 'm'
  var dcm = '#'+ cm
  var docList
  if (cm=='c') {
    if (topRef==null) return;
    docList = gold[topRef].refs
    $('#cTbl').empty() 
    $('#CollPanel').attr('dt_label', topRef).show() // dt_label never used?
    $('#BtColl'+topRef).css("background-color","lightgreen") 
  }
  else docList = mels[topRef]?.docs ?? []
  { //ligne des titres de colonne
    var keySet = new Set()  
    docList.forEach(doc => Object.keys(doc).forEach (key => {if(!key.startsWith('url')) keySet.add(key)}))
    var hideKeys = ['col', 'docs', 'sxs', 'X', 'Y',]
    if (cm == 'm') hideKeys.push('mel')
    else hideKeys.push('attributsDeMel') //only used in 'AU' (for now?)
    if (!$('#msczOptions')[0].checked) hideKeys.push('mscz')
    var shownKeys = Array.from(keySet).filter(key => !hideKeys.includes(key))
    const firstKeys = ['mel','f', 'ref','mels','titre','musicien','commentaire', 'etc']  // used for column order and etcKeys definition
    var etcKeys = []                                   
    var etcSettings = Number($('#etcOptions')[0].value) //0=réduit, 1=etc, 2=toutes les colonnes
    if (etcSettings < 2) etcKeys = shownKeys.filter(key => !firstKeys.includes(key))
    function highVal(x) {return x==-1 ? 100 : x} 
    shownKeys.sort((a, b)=> highVal(firstKeys.indexOf(a)) - highVal(firstKeys.indexOf(b)))
    var columnHeads = []
    if (etcKeys.length>1) {
      columnHeads = shownKeys.filter(k=> firstKeys.includes(k))
      if (etcSettings) columnHeads.push('etc')
    } else {
      columnHeads = shownKeys
      etcKeys = []
    }
    $(dcm+'Tbl').empty()
    $(dcm+'Tbl').append($('<thead id="'+cm+'TblHd" />'))
    if(cm == 'c') // insertion de la ligne-titre de la collection
      $('#cTblHd').append($('<tr/>').append($('<th class="collDesc" colspan='+columnHeads.length+' />')
      .html('<a href="'+urlHeadG+gold[topRef].colldoc+'">'+ gold[topRef].name +' </a>')))
    columnHeads.forEach(key => $(dcm+'TblHd').append($('<th class="collDesc" />').text(key)))
    $(dcm+'Tbl').append($('<tbody id="'+cm+'TblBd" />')) 
  }

  var vidSettings = Number($('#videoOptions')[0].value) //0=rien, 1=A, 2=AV
  docList.forEach((doc, i) => {
    $(dcm+'TblBd').append($('<tr id="doc'+cm+i+'"/>')) 
    var ddcmi ='#doc'+cm+i  //identifiant DOM de la ligne du tableau (collection ou mélodie) concerné
    var flatSxs = []      //tableau d'objets donnant {pav, char, butId, address, label} pour tous les suffixes d'un doc
    doc.sxs?.forEach((sxm, pav) => {
       if (pav==2 && !vidSettings) return // purge des vidéos si demandé
       sxm.split(',').forEach(sx => {
          if (sx ) 
            if (pav == 3) doc.mscz = "."  //je créé cet attribut provisoire (c'est dégueu!)
            else {
              var s = {}
              s.pav = pav
              s.char = sx[0].replace('.','') //le fameux suffChar, éventuellement vide!!
              s.address = (sx.slice(-4)=='.url' 
                  ? col[doc.col]['url'+s.char+'Pref'] + doc['url'+s.char] + (col[doc.col]['url'+s.char+'Suf'] ?? '')
                  : urlHeadC + prefixes[doc.col] + '/' + doc.ref+sx)
              s.butId = (doc.ref + sx).replaceAll('.','_').replaceAll('#','_')
              if (s.char) { s.label = s.char  ;  flatSxs.push(s)    } 
              else        { s.label = doc.ref ;  flatSxs.unshift(s) } //pour montrer le n° de mél sur le 1er bouton à gauche
           }
    })})
    var etcText = []
    if (etcSettings==0) {
      shownKeys = shownKeys.filter(k => !etcKeys.includes(k))
      etcKeys = []
    }
    shownKeys.forEach(key => {
      if (doc[key]==undefined) {if (!etcKeys.includes(key)) $(ddcmi).append($('<td/>'))}
      else switch (key) {
        case 'mel':
          if (cm=='m') $(ddcmi).append($('<td/>'))
          else {
            $(ddcmi).append($('<td/>').append($('<button id="m'+doc.mel+'Bt'+i+'"/>').text('m'+doc.mel)))
            document.querySelector('#m'+doc.mel+'Bt'+i).addEventListener('click', function() {
              showMelPanel((doc?.sxs?.[1]?.split(',')[0] ?? false) ? i + flatCollFirst[doc.col] : doc.mel )})
          }
          break
        case 'ref':
          var htmlText = ''
          if ((flatSxs[0]?.label ?? 0) != doc.ref) htmlText = doc.ref 
          flatSxs.forEach(s => {htmlText += ' <button id="'+s.butId+'Bt" class="DtaMedia'+s.pav+(s.pav==2 && vidSettings==1 ? 'a">' : '">') +s.label+ '</button>'})
          $(ddcmi).append($('<td/>').html(htmlText))
          flatSxs.forEach(s => { 
            document.querySelector('#'+s.butId+'Bt').addEventListener('click', function() {
              if (s.pav && (s.pav==1 || (vidSettings<2))) playAV(s, doc) // pour de l'audio ou [de la vidéo sans image] 
              else window.open(s.address,'popup','width=600,height=600') //pour de la vidéo
            })
            if (doc==dcfa && s.pav==1) { 
              playAV(s, doc) ; 
              dcfa == undefined 
            }  // au cas "c" (collection) il faut aussi fermer le melPanel si [mauvaise mél ]
          })
          break;
        case 'mels':  //seulement dans DS
          if (doc.mels) 
            doc.mels.forEach(m => {
                  $(ddcmi).append($('<button id="m'+m+'Bt'+i+'"/>').text(m))
                  document.querySelector('#m'+m+'Bt'+i).addEventListener('click', () => {
                    showMelPanel(m)})
            })
          break
        case 'f':
          $(ddcmi).append($('<td/>').text( doc.f.f))
          break
        case 'mscz':
          $(ddcmi).append($('<td/>').text(doc.ref+doc.sxs[3]+'mscz'))
          doc.mscz = undefined //cleanup!!
          break
        case 'titre':
          $(ddcmi).append($('<td/>').html(doc.titre.replaceAll(' ; ','<br>')))
          break
        default:
          if (etcKeys.includes(key)) etcText.push(key+': '+doc[key]) // rallonger le contenu de la col 'etc'
          else $(ddcmi).append($('<td/>').text(doc[key]))
    }})
    if (etcKeys.length) $(ddcmi).append($('<td/>').html(etcText.join('<br>')))
})}

function showDoumMenu(mot, dmArray) {   //doum :doc ou mel
  $('#aeTb').empty()  // au plus tard!
  var dml = dmArray.length
  if (!dml) return
  var gl = $('#MelPanel').children().length 
  var c2 = (dml>1) // s'il y a plusieurs doums 
  $('#aeTb').append($('<tr/>').append($('<table/>')
    .html(`${dml} ${gl ? ' autre' + (c2 ? 's' : '') : ''} titre${c2 ? 's' : ''} en "${mot}" ${gl ? '' : '(pas de mel)'}<button id="vuBt">vu${c2 ? 's' : ''}</button> :`)))
  document.querySelector('#vuBt').addEventListener('click', function() {$('#aeTb').empty()}) 
  $('#aeTb').append($('<tr/>').append($('<table id="altEntries" style="height: 100px; overflow: auto"/>')))
  dmArray.forEach((dm,i) => { 
    domKeys = new Set(Object.keys(dm))
    $('#altEntries').append($('<tr id="aE'+i+'"/>'))
    if (domKeys.has('ref')) {//ce n'est pas une mel
      $('#aE'+i).append($('<td/>').html(`<a>${dm.ref}</a>`))
      $('#aE'+i).append($('<td/>').html(`<a ${dm.lien ? `href="${dm.lien}"` : ''}>${dm.titre??'fiche de danse'}</a>`))  //titre undefined
    }
    else {//c'est une mel
      $('#aE'+i).append($('<td/>').append($('<button id="aEg'+dm.mel+'Bt"/>').text('m'+dm.mel)))
      document.querySelector('#aEg'+dm.mel+'Bt').addEventListener('click', function() {
        showMelPanel(dm.mel)
        $('#aeTb').empty()
      })
      titres = (dm.docs ? Array.from(dm.docs, doc=>doc.titre) : [])
      if (dm.titre) titres.push(dm.titre)
      $('#aE'+i).append($('<td/>').text(titres.join('_')))
}})}

function autocomplete(inp, arr) {
  /*arguments: inp: text field element ; arr: array of possible autocompleted values:*/
  var currentFocus;

  /*executed when someone writes in the text field:*/
  inp.addEventListener("input", function(e) {
      var a, b, i, val = this.value;
      /*close any already open lists of autocompleted values*/
      closeAllLists();
      if (!val) { return false;}
      currentFocus = -1;
      /*create a DIV element that will contain the items (values):*/
      a = document.createElement("DIV");
      a.setAttribute("id", this.id + "autocomplete-list");
      a.setAttribute("class", "autocomplete-items");
      /*append the DIV element as a child of the autocomplete container:*/
      this.parentNode.appendChild(a);
      /*for each item in the array...*/
      for (i = 0; i < arr.length; i++) {
        /*check if the item starts with the same letters as the text field value:*/
        if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
          /*create a DIV element for each matching element:*/
          b = document.createElement("DIV");
          /*make the matching letters bold:*/
          b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
          b.innerHTML += arr[i].substr(val.length);
          /*insert a input field that will hold the current array item's value:*/
          b.innerHTML += "<input type='hidden' value='" + arr[i] +"'>";
          /*execute a function when someone clicks on the item value (DIV element):*/
          b.addEventListener("click", function(e) {
              /*insert the value for the autocomplete text field:*/
              inp.value = this.getElementsByTagName("input")[0].value;
              var entry = dico.find(el => el.mot == inp.value)  //retourne le No d'élément, un dicoWord
              //entry.refs.forEach(ref => console.log(flatColl[ref]))  // à remplacer progressivement!
              var entryRefs = Array.from(entry.refs).sort(function(a, b) {
                return a - b;
              })
              if (entryRefs[0] < mels.length) showMelPanel(entryRefs.shift()) //c'est une mel
              else showMelPanel(null)
              showDoumMenu(inp.value, Array.from(entryRefs, el => flatColls[el]))
              /*close the list of autocompleted values,
              (or any other open lists of autocompleted values:*/
              closeAllLists();
          });
          a.appendChild(b);
        }
      }
  });

  /*execute a function when a key on the keyboard is pressed:*/
  inp.addEventListener("keydown", function(e) {
      var x = document.getElementById(this.id + "autocomplete-list");
      if (x) x = x.getElementsByTagName("div");
      if (e.keyCode == 40) {
        /*If the arrow DOWN key is pressed,
        increase the currentFocus variable:*/
        currentFocus++;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 38) { //up
        /*If the arrow UP key is pressed,
        decrease the currentFocus variable:*/
        currentFocus--;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 13) {
        /*If the ENTER key is pressed, prevent the form from being submitted,*/
        e.preventDefault();
        if (currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          if (x) x[currentFocus].click();
        }
      }
  });
  function addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    /*add class "autocomplete-active":*/
    x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
      x[i].parentNode.removeChild(x[i]);
    }
  }
}
/*execute a function when someone clicks in the document:
document.addEventListener("click", function (e) {
  //console.log("click somewhere:")
  //console.log(e)
    //closeAllLists(e.target);
});*/
} 
