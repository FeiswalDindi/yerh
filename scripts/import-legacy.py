"""Extract owned legacy content as plain structured data; never execute mirror code."""
import sys, json, re, shutil, hashlib, warnings
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs
sys.path.insert(0, str(Path(__file__).parent/'python-libs'))
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
warnings.filterwarnings('ignore',category=XMLParsedAsHTMLWarning)
import argparse
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', required=True, type=Path)
parser.add_argument('--brand', required=True, type=Path)
parser.add_argument('--out', required=True, type=Path)
args = parser.parse_args()
ROOT = args.source.resolve()
SITE = ROOT / 'yerh-kenya.kcau.ac.ke'
DEST = args.out.resolve()
FEISO = args.brand.resolve()
if (DEST / 'package.json').exists():
    raise SystemExit('Import into an empty staging directory, then review and merge fixtures. Never overwrite the application.')
if not (SITE / 'index.html').is_file():
    raise SystemExit('Source must be a restored original mirror root')
if not (FEISO / 'package.json').is_file():
    raise SystemExit('Brand must be the Feiso application root')
for d in ['public/media','src/content','docs','scripts','tests']: (DEST/d).mkdir(parents=True,exist_ok=True)
assets={}
def copy_asset(p):
    if not p or not p.is_file(): return None
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    name=re.sub(r'[^a-z0-9.-]+','-',p.stem.lower()).strip('-')[:65]+'-'+digest[:8]+p.suffix.lower()
    url='/media/'+name
    if url not in assets:
        shutil.copyfile(p,DEST/'public'/url.lstrip('/'))
        assets[url]={'source':str(p),'sha256':digest,'bytes':p.stat().st_size}
    return url
def resolve(src,page):
    if not src: return None
    src=unquote(src.split('?')[0].split('#')[0])
    if src.startswith('data:'): return None
    if 'wp-content/' in src: p=SITE/'wp-content'/src.split('wp-content/',1)[1]
    elif not urlparse(src).scheme: p=(page.parent/src).resolve()
    else: return None
    return p if p.is_file() and p.suffix.lower() in ['.jpg','.jpeg','.webp','.png','.svg','.pdf'] else None
def clean(text): return re.sub(r'\s+',' ',text).strip().replace('\ufffd',"'")
def load(p): return BeautifulSoup(p.read_text(encoding='utf-8',errors='replace'),'html.parser')
def extract(p,kind):
    soup=load(p);main=soup.select_one('main') or soup
    title=main.select_one('h1') or soup.title
    title=clean(title.get_text(' ',strip=True)).split(' – Youth Entrepreneurship')[0]
    area=soup.select_one('article') or soup.select_one('#tab-description') or soup.select_one('.etn-event-single-wrap') or main
    for e in area.select('script,style,form,.post-navigation,.author-bio,.comments-area,.sharedaddy,nav,.etn-add-calender-url,.author-box,.post-meta'): e.decompose()
    blocks=[]
    for e in area.select('h2,h3,h4,p,li'):
        if e.find_parent(['li','p']): continue
        text=clean(e.get_text(' ',strip=True))
        if len(text)<12 or text.startswith('By YERH_TEAM') or any(x in text for x in ['Leave a Reply','Your email address will not','Empower young people to become entrepreneurs']):continue
        blocks.append({'type':'heading' if e.name.startswith('h') else 'list-item' if e.name=='li' else 'paragraph','text':text})
    if not blocks:
        text=area.get_text('\n',strip=True)
        blocks=[{'type':'paragraph','text':clean(t)} for t in text.split('\n') if len(clean(t))>60]
    image=None
    for e in [*soup.select('meta[property="og:image"]'),*main.select('img')]:
        pimg=resolve(e.get('content') or e.get('src'),p)
        if pimg and '/uploads/' in pimg.as_posix() and not any(x in pimg.name.lower() for x in ['logo','avatar','bpthumb','bpfull']):
            image=copy_asset(pimg);break
    downloads=[];videos=[]
    for widget in area.select('[data-settings]'):
        try:
            settings=json.loads(widget['data-settings'])
            if settings.get('youtube_url'):videos.append(settings['youtube_url'])
        except ValueError: pass
    for e in area.select('a[href],iframe[src]'):
        u=e.get('href') or e.get('src')
        if not u:continue
        if '.pdf' in u.lower():
            u=parse_qs(urlparse(u).query).get('file',[u])[0]
            asset=copy_asset(resolve(u,p))
            href=asset or ('https://yerh-kenya.kcau.ac.ke/'+u.lstrip('/') if not urlparse(u).scheme else u)
            if not urlparse(u).scheme and not asset:
                from urllib.parse import urljoin
                href=urljoin('https://yerh-kenya.kcau.ac.ke/'+p.relative_to(SITE).as_posix(),u)
            downloads.append({'label':clean(e.get_text(' ',strip=True)) or 'Read the publication','href':href,'availableLocally':bool(asset)})
        if 'youtube.com/embed/' in u:videos.append('https://www.youtube.com/watch?v='+u.split('/embed/')[1].split('?')[0])
        elif 'youtu.be/' in u or 'youtube.com/watch' in u: videos.append(u)
    slug=p.parent.name
    date=soup.select_one('time[datetime]')
    if not date:date=soup.select_one('meta[property="article:published_time"]')
    published=(date.get('datetime') or date.get('content'))[:10] if date else None
    categories=[clean(e.get_text(' ',strip=True)) for e in soup.select('a[rel="category tag"]')]
    category=categories[0] if categories else {'story':'Entrepreneur stories','article':'Entrepreneurship','business':'Youth enterprise','publication':'Research & reports','event':'Past event','resource':'Business skills'}[kind]
    paragraphs=[b['text'] for b in blocks if b['type']=='paragraph']
    excerpt=paragraphs[0][:190].rsplit(' ',1)[0]+'…' if paragraphs else 'Explore this resource from the Youth Entrepreneurship Resource Hub.'
    return {'id':slug,'slug':slug,'kind':kind,'title':title,'category':category,'excerpt':excerpt,'image':image,'imageAlt':title,'publishedAt':published,'blocks':blocks,'downloads':downloads,'videos':list(dict.fromkeys(videos)),'source':{'path':p.relative_to(ROOT).as_posix(),'url':'https://yerh-kenya.kcau.ac.ke/'+p.relative_to(SITE).as_posix().replace('index.html',''),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}}

content=[]
for p in sorted(SITE.glob('*/index.html')):
    prefix=p.parent.name
    raw=p.read_text(encoding='utf-8',errors='replace')
    page_soup=BeautifulSoup(raw,'html.parser')
    if page_soup.body and 'single-post' in page_soup.body.get('class',[]):
        kind='publication' if prefix.startswith('copyek-') else 'story' if 'entrepreneur' in prefix and any(n in prefix for n in ['paul','debbie','isaac']) or 'my-story' in prefix else 'article'
        content.append(extract(p,kind))
for directory,kind in [('shop','business'),('etn','event')]:
    for p in sorted((SITE/directory).glob('*/index.html')):
        if p.parent.name != 'feed':content.append(extract(p,kind))
# Explicit images and concise descriptions for records represented mainly by video.
overrides={
 'debbie-gitonga-entrepreneur':('2023/12/Debbie-Gitonga-Entrepreneur.jpg','Debbie Gitonga','DWG sole proprietor. Discover the journey behind the business.','Creative enterprise'),
 'isaac-kamau-entrepreneur-founder-koikoi-group-software-solutions-company':('2023/12/IMG_5789-min-1-960x540-1.jpg','Isaac Kamau','Founder of Koikoi Group, a software solutions company.','Technology'),
 'paul-wambua-entrepreneur-associate-at-brooklyn-farm':('2023/12/Paul-wambua.png','Paul Wambua','Entrepreneur and associate at Brooklyn Farm.','Agribusiness')
}
for item in content:
    if item['slug'] in overrides:
        img,title,excerpt,cat=overrides[item['slug']]
        item.update(image=copy_asset(SITE/'wp-content/uploads'/img) or item['image'],title=title,excerpt=excerpt,category=cat)
    if item['kind']=='business':
        item['blocks']=[b for b in item['blocks'] if not any(t in b['text'] for t in ['Related products','reviews','Your rating','Be the first to review','Name *','Email *'])]
        item['category']={'comfort-worms-and-insects':'Agribusiness','joyride-medical-center':'Healthcare','mowrahs-designs':'Creative enterprise','sued-watches':'Fashion & design'}.get(item['id'],'Youth enterprise')
    if item['kind']=='publication':
        item['excerpt']={'copyek-final-report':'Explore the final report from the Co-Production for Youth Entrepreneurship in Kenya project.','copyek-advocacy-briefs':'Research and advocacy for an environment where young entrepreneurs can thrive.','copyek-success-stories-and-impact':'Discover the stories, learning, and impact of the COPYEK project.'}[item['id']]

# Resources are the actual Getting Started syllabus and original outbound lesson links.
resources=load(SITE/'resources/index.html')
resource_links=[]
for a in resources.select('p'):
    label=clean(a.get_text(' ',strip=True))
    if label in ['Business Opportunities Mapping and Idea Generation','Basic Record Keeping in Business','Business Registration and Licensing','Introduction to Business Planning','Sources of Business Financing & Introduction to Youth Fund','Effective Marketing Strategies for MSMEs']:
        if label not in [v['title'] for v in resource_links]:
            from urllib.parse import urljoin
            column=a.find_parent('div',class_='elementor-column')
            widget=column.select_one('[data-settings]') if column else None
            href=json.loads(widget['data-settings']).get('youtube_url') if widget else None
            if href: resource_links.append({'id':re.sub('[^a-z0-9]+','-',label.lower()).strip('-'),'title':label,'href':href})

media={
 'team':copy_asset(SITE/'wp-content/uploads/2022/09/Be-part-of-the-team.jpg'),
 'developers':copy_asset(SITE/'wp-content/uploads/2023/04/Youth-Enterprise-Resource-Hub-Development-Journey-–-Take-from-the-YERH-Developers.jpg'),
 'workshop':copy_asset(SITE/'wp-content/uploads/2023/11/Image-2.png'),
 'business':copy_asset(SITE/'wp-content/uploads/2023/04/Mowrah-Designs.jpg'),
 'logo':copy_asset(FEISO/'src/assets/yerh-logo (2).png'),
 'partners':[]
}
for name,file,url in [('KCA University','KCA University logo.png','https://www.kcau.ac.ke/'),('Youth Enterprise Development Fund','youth enterprise logo.jpg','https://www.youthfund.go.ke/'),('University of Nottingham','UoNottingham.jpg','https://www.nottingham.ac.uk/business/'),('British Council','British Council.png','https://www.britishcouncil.co.ke/')]:
    media['partners'].append({'name':name,'image':copy_asset(FEISO/'public'/file),'url':url})

data={'items':content,'lessons':resource_links,'media':media}
(DEST/'src/content/catalog.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
(DEST/'docs/asset-manifest.json').write_text(json.dumps(assets,indent=2),encoding='utf-8')
mapping={v['source']['path']:f"/{'stories' if v['kind']=='story' else 'businesses' if v['kind']=='business' else 'events' if v['kind']=='event' else 'publications' if v['kind']=='publication' else 'news'}/{v['slug']}" for v in content}
top={'':'/','about-us':'/about','contact-us':'/contact','resources':'/resources','success-stories':'/stories','news':'/news','news-classic':'/news','blogz':'/news','publications':'/publications','faq':'/about#faq','our-courses':'/resources','mentorship':'/community','forums':'/community','forum':'/community','forum-2':'/community','groups':'/community','shop':'/businesses','webinar':'/events','workshop':'/events','login':'/login','login-3':'/login','my-account':'/login','privacy-policy':'/privacy','terms-conditions':'/terms','cookies':'/privacy'}
aliases={}
for slug,url in top.items():mapping['yerh-kenya.kcau.ac.ke/'+(slug+'/' if slug else '')+'index.html']=url;aliases['/'+slug]=url
route_map=[]
for p in sorted(ROOT.rglob('*.html')):
    rel=p.relative_to(ROOT).as_posix(); dest=mapping.get(rel)
    if dest:
        status='migrated'; reason='Structured content or redesigned page'
        aliases['/'+p.relative_to(SITE).as_posix().replace('/index.html','') if p.is_relative_to(SITE) else '/']=dest
    elif any(x in rel for x in ['wp-content','wp-includes','hts-cache','wp-json','feed/','wp-admin']):status='archived';reason='WordPress runtime, feed, attachment or generated metadata'
    elif any(x in rel for x in ['/members/','/activity/','/groups/','/forums/']):status='integration';reason='Community data requires the future identity/backend provider'
    else:status='archived';reason='Duplicate index, archive listing, embed, legacy utility or taxonomy; retained in full source archive'
    route_map.append({'source':rel,'route':dest,'status':status,'reason':reason})
(DEST/'docs/route-migration.json').write_text(json.dumps(route_map,indent=2),encoding='utf-8')
(DEST/'src/content/legacy-routes.json').write_text(json.dumps(aliases,indent=2),encoding='utf-8')
print(json.dumps({'records':len(content),'kinds':{k:sum(x['kind']==k for x in content) for k in set(x['kind'] for x in content)},'lessons':len(resource_links),'assets':len(assets),'htmlRoutes':len(route_map),'recordTitles':[(x['kind'],x['title']) for x in content]},ensure_ascii=True))
