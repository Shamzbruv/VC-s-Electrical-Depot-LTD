"""Staging-only concurrency test. Reads ignored .dev.vars, restores all fixtures."""
import json,urllib.request,urllib.error,pathlib,uuid,concurrent.futures,hashlib
cfg={k:json.loads(v) for k,v in (l.split('=',1) for l in pathlib.Path('.dev.vars').read_text().splitlines())}
base=cfg['SUPABASE_URL']+'/rest/v1/'
key=cfg['SUPABASE_SERVICE_ROLE_KEY']
def req(path,method='GET',data=None):
 r=urllib.request.Request(base+path,method=method,data=json.dumps(data).encode() if data is not None else None,headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'return=representation'})
 try:
  with urllib.request.urlopen(r,timeout=35) as out:return json.load(out) if out.status!=204 else None
 except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode())
pid=str(uuid.uuid4());old=req('store_settings?key=eq.commerce')[0]['value'];created=[]
try:
 req('products','POST',{'id':pid,'name':'STAGING CONCURRENCY TEST - DO NOT ORDER','sku':'TEST-'+pid,'slug':'test-'+pid,'category':'Tests','description':'Disposable transaction test fixture','price':100,'store_price':200,'stock':1,'status':'published','sample':False})
 req('store_settings?key=eq.commerce','PATCH',{'value':{**old,'bank_enabled':True,'bank_instructions':'STAGING TEST - DO NOT PAY','pickup_address':'STAGING TEST ADDRESS'}})
 def buy(i):
  try:
   out=req('rpc/create_order','POST',{'p':{'key':str(uuid.uuid4()),'request_hash':'race-'+str(i),'access_hash':'unusable-test-token','email':'race@example.invalid','name':'Staging test','phone':'8760000000','method':'pickup','address':{},'items':[{'id':pid,'qty':1}],'expected_total':100}});created.append(out['id']);return 'success'
  except RuntimeError as e:
   if 'Insufficient stock' in str(e):return 'out_of_stock'
   raise
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(buy,[1,2]))
 assert sorted(results)==['out_of_stock','success'],results
 p=req('products?id=eq.'+pid)[0];assert p['reserved']==1 and p['stock']==1
 print('PASS: simultaneous buyers: one order, one out-of-stock response; reserved=1, stock=1')
finally:
 req('store_settings?key=eq.commerce','PATCH',{'value':old})
 orders=req('orders?email=eq.race@example.invalid&select=id,items')
 for o in orders:
  if any(i['id']==pid for i in o['items']):
   oid=o['id']
   for table,fk in [('discount_redemptions','order_id'),('invoices','order_id'),('payment_attempts','order_id'),('email_notifications','entity_id'),('stock_movements','order_id'),('order_events','order_id')]:req(table+'?'+fk+'=eq.'+oid,'DELETE')
   req('orders?id=eq.'+oid,'DELETE')
 req('products?id=eq.'+pid,'DELETE')
 print('Fixtures removed; original checkout settings restored')
