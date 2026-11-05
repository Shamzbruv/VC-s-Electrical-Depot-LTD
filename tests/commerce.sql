-- Run in the private staging database. Every fixture and settings change is rolled back.
begin;
do $$declare p uuid:=gen_random_uuid();k uuid:=gen_random_uuid();o jsonb;again jsonb;oldprice bigint;blocked bool:=false;begin
 if has_table_privilege('anon','public.orders','SELECT') then raise exception 'Anonymous orders exposed';end if;
 if has_function_privilege('anon','public.create_order(jsonb)','EXECUTE') then raise exception 'Public order RPC exposed';end if;
 update store_settings set value=value||'{"bank_enabled":true,"bank_instructions":"STAGING TEST ONLY - DO NOT PAY","pickup_address":"STAGING TEST LOCATION"}' where key='commerce';
 insert into products(id,name,slug,sku,category,price,store_price,stock,status,sample) values(p,'Transaction test','transaction-test-'||p,'TEST-'||p,'Tests',12500,17500,1,'published',false);
 o:=create_order(jsonb_build_object('key',k,'request_hash','test-fingerprint','access_hash','test-hash','email','staging@example.invalid','name','Test','phone','8760000000','method','pickup','address','{}'::jsonb,'items',jsonb_build_array(jsonb_build_object('id',p,'qty',1)),'expected_total',12500));
 if (o->>'total')::bigint<>12500 then raise exception 'Online price not used';end if;
 if (select reserved from products where id=p)<>1 then raise exception 'Reservation missing';end if;
 again:=create_order(jsonb_build_object('key',k,'request_hash','test-fingerprint'));
 if o->>'id'<>again->>'id' then raise exception 'Duplicate order';end if;
 begin perform create_order(jsonb_build_object('key',gen_random_uuid(),'request_hash','second','access_hash','second','email','second@example.invalid','name','Test','phone','8760000000','method','pickup','address','{}'::jsonb,'items',jsonb_build_array(jsonb_build_object('id',p,'qty',1)),'expected_total',12500));exception when others then if SQLERRM like 'Insufficient stock%' then blocked:=true;else raise;end if;end;
 if not blocked then raise exception 'Oversell accepted';end if;
 blocked:=false;begin perform order_action((o->>'id')::uuid,'picking','test',null);exception when others then if SQLERRM like 'Verify payment%' then blocked:=true;else raise;end if;end;
 if not blocked then raise exception 'Unpaid fulfilment accepted';end if;
 perform order_action((o->>'id')::uuid,'verify_payment','STAGING-EXTERNAL-REF',null);
 if (select stock from products where id=p)<>0 or (select reserved from products where id=p)<>0 then raise exception 'Stock commit failed';end if;
 update products set price=99999 where id=p;
 if (select total from orders where id=(o->>'id')::uuid)<>12500 then raise exception 'Snapshot changed';end if;
 if not exists(select 1 from invoices where order_id=(o->>'id')::uuid) then raise exception 'Invoice missing';end if;
 perform order_action((o->>'id')::uuid,'picking','Test',null);perform order_action((o->>'id')::uuid,'packed','Test',null);perform order_action((o->>'id')::uuid,'ready_for_pickup','Test',null);perform order_action((o->>'id')::uuid,'collected','Test',null);
end$$;
rollback;
select 'PASS: online pricing, reservations, idempotent retry, oversell rejection, unpaid fulfilment block, payment stock commitment, invoice snapshot and pickup transitions' as result;
