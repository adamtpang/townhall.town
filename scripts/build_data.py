"""Builds data/*.json from research snapshots in ../research (Ballotpedia HTML, Census Reporter ACS JSON)."""
import re, json, glob, datetime, urllib.request
from bs4 import BeautifulSoup
R='/workspace/townhall/research/'
OUT='/workspace/townhall/site/data/'
now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')

OFFICE = {
 'us-senate':'Writes and votes on federal laws, confirms judges and cabinet picks, ratifies treaties. 6-year term.',
 'us-house':'Writes and votes on federal laws and the federal budget; all spending bills start in the House. 2-year term.',
 'gov':'Runs the state executive branch, signs or vetoes state laws, appoints many officials, can call special sessions.',
 'tx-ltgov':'Presides over the Texas Senate and controls which bills get heard there; one of the most powerful offices in Texas.',
 'tx-ag':'The state\'s lawyer: sues and defends on behalf of Texas, enforces consumer protection, collects child support.',
 'tx-comptroller':'Texas\'s tax collector and accountant; certifies whether the state budget fits projected revenue.',
 'tx-land':'Manages state-owned land and mineral rights (money goes to schools), the Alamo, and disaster housing recovery.',
 'tx-agcomm':'Regulates agriculture, fuel pumps and scales, and runs school-lunch nutrition programs.',
 'tx-rrc':'Despite the name, regulates oil, gas, pipelines and mining in Texas (not railroads).',
 'ca-ltgov':'Steps in when the governor is away; casts tie-breaking votes in the state Senate; sits on university boards.',
 'ca-ag':'California\'s top lawyer and law-enforcement officer; sues and defends on behalf of the state.',
 'ca-sos':'Runs state elections, certifies results, and keeps business filings.',
 'ca-controller':'The state\'s chief fiscal officer: pays the state\'s bills and audits how money is spent.',
 'ca-treasurer':'Manages the state\'s cash and investments and sells state bonds.',
 'ca-insurance':'Regulates insurance companies and approves or rejects rate increases (home, auto, health).',
 'ca-spi':'Leads the state Department of Education; nonpartisan office overseeing K-12 public schools.',
}
def parse(f):
    s=BeautifulSoup(open(R+f,errors='ignore'),'html.parser')
    full=s.get_text(' ',strip=True)
    incs=set(m.group(1).strip() for m in re.finditer(r'Incumbent ([A-Z][\w\.\'\- ]+?) \(',full))
    canon=s.find('link',rel='canonical'); canon=canon.get('href') if canon else None
    for h in s.select('h5.votebox-header-election-type'):
        title=h.get_text(' ',strip=True)
        vb=h.find_parent('div',class_='votebox'); p=vb.select_one('p.results_text') if vb else None
        if not title.startswith('General election') or not p or 'November 3, 2026' not in p.get_text(): continue
        cands=[]
        for row in vb.select('tr.results_row'):
            c=row.select_one('td.votebox-results-cell--text')
            if not c: continue
            txt=c.get_text(' ',strip=True)
            if 'Write-in' in txt: continue
            a=c.find('a'); nm=a.get_text(strip=True) if a else txt
            m=re.search(r'\(([^)]+)\)',txt)
            pm={'D':'Democratic','R':'Republican','L':'Libertarian','G':'Green'}
            pty=m.group(1) if m else None
            cands.append({'name':nm,'party':pm.get(pty,pty) if pty else 'unsure','ballotpedia':a.get('href') if a else None,'incumbent':nm in incs})
        return {'title':title.replace('General election for ',''),'source':canon,'candidates':cands}
    return None

def race(id,f,office,level,juris):
    r=parse(f)
    if not r: return {'id':id,'title':id,'level':level,'office':OFFICE[office],'candidates':[],'source':None,'note':'Candidate list not parsed from our Ballotpedia snapshot: unsure. Check your sample ballot.'}
    for c in r['candidates']:
        q=urllib.parse.quote(c['name'])
        if level=='federal': c['finance']={'label':'FEC filings (search)','url':f'https://www.fec.gov/data/candidates/?search={q}'}
        elif juris=='TX': c['finance']={'label':'TEC filings (search)','url':'https://www.ethics.state.tx.us/search/cf/'}
        elif juris=='CA': c['finance']={'label':'Cal-Access (search)','url':'https://cal-access.sos.ca.gov/Campaign/Candidates/'}
        c['officialSite']=None
    return {'id':id,'title':r['title'],'level':level,'office':OFFICE[office],'candidates':r['candidates'],'source':r['source']}
import urllib.parse
TX_STATE=[race('us-senate-tx','United_States_Senate_election_in_Texas__2026.html','us-senate','federal','TX'),
 race('tx-gov','Texas_gubernatorial_election__2026.html','gov','state','TX'),
 race('tx-ltgov','Texas_lieutenant_gubernatorial_election__2026.html','tx-ltgov','state','TX'),
 race('tx-ag','Texas_Attorney_General_election__2026.html','tx-ag','state','TX'),
 race('tx-comptroller','Texas_Comptroller_election__2026.html','tx-comptroller','state','TX'),
 race('tx-land','Texas_Land_Commissioner_election__2026.html','tx-land','state','TX'),
 race('tx-agcomm','Texas_Agriculture_Commissioner_election__2026.html','tx-agcomm','state','TX'),
 race('tx-rrc','Texas_Railroad_Commission_election__2026.html','tx-rrc','state','TX')]
CA_STATE=[race('ca-gov','ca/California_gubernatorial_election__2026.html','gov','state','CA'),
 race('ca-ltgov','ca/California_lieutenant_gubernatorial_election__2026.html','ca-ltgov','state','CA'),
 race('ca-ag','ca/California_Attorney_General_election__2026.html','ca-ag','state','CA'),
 race('ca-sos','ca/California_Secretary_of_State_election__2026.html','ca-sos','state','CA'),
 race('ca-controller','ca/California_Controller_election__2026.html','ca-controller','state','CA'),
 race('ca-treasurer','ca/California_Treasurer_election__2026.html','ca-treasurer','state','CA'),
 race('ca-insurance','ca/California_Insurance_Commissioner_election__2026.html','ca-insurance','state','CA'),
 race('ca-spi','ca/California_Superintendent_of_Public_Instruction_election__2026.html','ca-spi','state','CA')]
def house(id,f): return race(id,f,'us-house','federal',id[:2].upper())
H={'tx-10':house('tx-10','d/Texas_27_10th_Congressional_District_election__2026.html'),
   'tx-21':house('tx-21','d/Texas_27_21st_Congressional_District_election__2026.html'),
   'tx-35':house('tx-35','d/Texas_27_35th_Congressional_District_election__2026.html'),
   'tx-37':house('tx-37','d/Texas_27_37th_Congressional_District_election__2026.html'),
   'ca-11':house('ca-11','ca/California_27s_11th_Congressional_District_election__2026.html'),
   'ca-34':house('ca-34','ca/California_27s_34th_Congressional_District_election__2026.html')}

# CA measures
s=BeautifulSoup(open(R+'ca/California_2026_ballot_propositions.html',errors='ignore'),'html.parser')
t=s.find('span',id='On_the_ballot').find_next('table'); CA_MEAS=[]
for r in t.select('tr')[1:]:
    tds=r.find_all('td'); a=tds[1].find('a')
    CA_MEAS.append({'id':tds[1].get_text(' ',strip=True),'title':tds[1].get_text(' ',strip=True)+' ('+tds[2].get_text(' ',strip=True).replace(' ;',',')+')','summary':tds[3].get_text(' ',strip=True),'type':tds[0].get_text(strip=True),'source':a.get('href')})
CA_MEAS.sort(key=lambda m:int(m['id'].split()[-1]))

# ACS
acs=json.load(open(R+'census/acs2024_cr.json'))
def problems(geo):
    x=acs['data'][geo]; e=lambda t,c: x[t]['estimate'][t+c]
    rb=sum(e('B25070',c) for c in ['007','008','009','010'])/(e('B25070','001')-e('B25070','011'))*100
    un=sum(e('B27010',c) for c in ['017','033','050','066'])/e('B27010','001')*100
    ue=e('B23025','005')/e('B23025','003')*100
    url=f'https://censusreporter.org/profiles/{geo}/'
    base={'year':'ACS 2024 5-year (2020-2024)'}
    return [
     dict(base,id='rent',topic='housing',label='Renters paying 30%+ of income on rent',value=round(rb,1),unit='%',table='B25070',source=f'https://censusreporter.org/data/table/?table=B25070&geo_ids={geo}'),
     dict(base,id='uninsured',topic='healthcare',label='People without health insurance',value=round(un,1),unit='%',table='B27010',source=f'https://censusreporter.org/data/table/?table=B27010&geo_ids={geo}'),
     dict(base,id='jobs',topic='jobs',label='Unemployment rate (labor force 16+)',value=round(ue,1),unit='%',table='B23025',source=f'https://censusreporter.org/data/table/?table=B23025&geo_ids={geo}'),
    ], {'medianIncome':e('B19013','001'),'medianRent':e('B25064','001'),'population':e('B01003','001'),'profile':url}
def compare(geo):
    p,_=problems(geo); return {q['id']:q['value'] for q in p}
PLAN='https://data.capitol.texas.gov/dataset/planc2333'
ZIPS={
 '78130':dict(state='TX',place='New Braunfels, TX',county='Comal County',counties=['05000US48091'],
   districts=[{'id':'tx-35','label':'TX-35 (U.S. House)','note':'ZIP centroid falls inside District 35 on PLANC2333'},{'id':'tx-21','label':'TX-21 (U.S. House)','note':'ZIP also borders/overlaps District 21 (centroid ~0.5 km away)'}],
   districtSource={'label':'Texas Legislative Council PLANC2333 shapefile (2025 congressional map) + Census 2024 ZCTA Gazetteer centroid','url':PLAN},
   splitWarning='This ZIP spans more than one U.S. House district. Your exact district depends on your street address.'),
 '78701':dict(state='TX',place='Austin, TX (downtown)',county='Travis County',counties=['05000US48453'],
   districts=[{'id':'tx-10','label':'TX-10 (U.S. House)','note':'ZIP centroid falls inside District 10 on PLANC2333'},{'id':'tx-37','label':'TX-37 (U.S. House)','note':'ZIP also borders/overlaps District 37 (centroid ~0.4 km away)'}],
   districtSource={'label':'Texas Legislative Council PLANC2333 shapefile (2025 congressional map) + Census 2024 ZCTA Gazetteer centroid','url':PLAN},
   splitWarning='This ZIP spans more than one U.S. House district. Your exact district depends on your street address.'),
 '94103':dict(state='CA',place='San Francisco, CA (SoMa)',county='San Francisco County',counties=['05000US06075'],
   districts=[{'id':'ca-11','label':'CA-11 (U.S. House)','note':'District assignment: unsure, verify with your county; based on Ballotpedia district coverage of San Francisco'}],
   districtSource={'label':'Ballotpedia: California\'s 11th Congressional District election, 2026','url':'https://ballotpedia.org/California%27s_11th_Congressional_District_election,_2026'},splitWarning=None),
 '90012':dict(state='CA',place='Los Angeles, CA (Downtown/Chinatown)',county='Los Angeles County',counties=['05000US06037'],
   districts=[{'id':'ca-34','label':'CA-34 (U.S. House)','note':'District assignment: unsure, verify with your county; downtown LA is in CA-34 per Ballotpedia'}],
   districtSource={'label':'Ballotpedia: California\'s 34th Congressional District election, 2026','url':'https://ballotpedia.org/California%27s_34th_Congressional_District_election,_2026'},splitWarning=None),
}
out={}
for z,info in ZIPS.items():
    p,extra=problems('86000US'+z)
    st='04000US48' if info['state']=='TX' else '04000US06'
    sc=compare(st)
    for q in p: q['stateValue']=sc[q['id']]
    races=[H[d['id']] for d in info['districts']]+(TX_STATE if info['state']=='TX' else CA_STATE)
    races=[x for x in races]
    meas = [] if info['state']=='TX' else CA_MEAS
    out[z]=dict(zip=z,**info,electionDate='2026-11-03',races=races,measures=meas,
       measuresNote=('No statewide Texas propositions found for Nov 3, 2026 in our sources (Texas constitutional amendments are usually voted in odd years). Local measures: unsure, check your county.' if info['state']=='TX' else 'Statewide propositions from Ballotpedia, as of Oct 28, 2026. Local measures not included.'),
       problems=p,context=extra,
       verify=({'label':'VoteTexas.gov (official)','url':'https://www.votetexas.gov/'} if info['state']=='TX' else {'label':'California Secretary of State (official)','url':'https://www.sos.ca.gov/elections'}),
       builtAt=now)
json.dump(out,open(OUT+'ballots.json','w'),indent=1)
print({z:[(r['id'],len(r['candidates'])) for r in v['races']] for z,v in out.items()})
