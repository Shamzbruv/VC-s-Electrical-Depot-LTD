begin;
do $$declare p uuid:=gen_random_uuid();coupon uuid:=gen_random_uuid();o jsonb;q jsonb;begin
 update store_settings set value=value||'{"bank_enabled":true,"bank_instructions":"STAGING TEST ONLY - DO NOT PAY","pickup_address":"STAGING TEST LOCATION"}' where key='commerce';
 insert into products(id,name,slug,sku,category,price,store_price,stock,status) values(p,'Promotion test','promo-test-'||p,'PROMO-'||p,'Tests',10000,20000,3,'published');
 insert into promotions(id,code,kind,value,max_uses,active) values(coupon,'TEST-'||coupon,'percent',10,1,true);
 q:=checkout_quote(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',p,'qty',1)),'method','pickup','promo','TEST-'||coupon));if (q->>'total')::bigint<>9000 then raise exception 'Incorrect promotion quote';end if;
 o:=create_order(jsonb_build_object('key',gen_random_uuid(),'request_hash','promo-test','access_hash','hash','email','test@example.invalid','name','Test','phone','8760000000','method','pickup','address','{}'::jsonb,'items',jsonb_build_array(jsonb_build_object('id',p,'qty',1)),'promo','TEST-'||coupon,'expected_total',9000));
 if (o->>'discount')::bigint<>1000 or (o->>'total')::bigint<>9000 then raise exception 'Incorrect promotion order';end if;
 if (select uses from promotions where id=coupon)<>1 then raise exception 'Redemption missing';end if;
 perform order_action((o->>'id')::uuid,'cancelled','Test cancellation',null);
 if (select uses from promotions where id=coupon)<>0 or (select reserved from products where id=p)<>0 then raise exception 'Cancellation release failed';end if;
end$$;
rollback;
select 'PASS: server quotation, percentage discount, exact JMD total, redemption, cancellation release' as result;
