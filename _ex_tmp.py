import re,html,sys
p=sys.argv[1]
h=open(p,encoding='utf-8',errors='replace').read()
i=h.find('<devsite-content>'); j=h.find('</devsite-content>',i)
if i<0: i,j=0,len(h)
s=h[i:j]
s=re.sub(r'(?is)<style.*?</style>','',s)
s=re.sub(r'(?is)<script.*?</script>','',s)
s=re.sub(r'(?is)<(tr|/tr|li|h1|h2|h3|h4|p|/table|br)[^>]*>','\n',s)
t=re.sub(r'(?s)<[^>]+>',' ',s)
t=html.unescape(t)
t=re.sub(r'[ \t\xa0]+',' ',t)
t=re.sub(r'\n\s*\n+','\n',t)
open(p+'.txt','w',encoding='utf-8').write(t)
print(len(t))
