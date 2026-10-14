import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db=new PrismaClient();
const nonce=randomUUID().replaceAll('-','');
let workspaceId;
try {
  const user=await db.user.create({data:{email:'stock-ci-'+nonce+'@example.invalid',passwordHash:'not-a-login-hash',displayName:'Stock QA'}});
  const workspace=await db.workspace.create({data:{name:'Stock QA',slug:'stock-ci-'+nonce,members:{create:{userId:user.id,role:'ADMIN'}}}});
  workspaceId=workspace.id;
  const product=await db.product.create({data:{workspaceId,name:'Test Product '+nonce,internalSku:nonce}});
  const warehouse=await db.warehouse.create({data:{workspaceId,name:'Test Warehouse',code:'CI_'+nonce.slice(0,10)}});
  const balance=await db.stockBalance.create({data:{workspaceId,warehouseId:warehouse.id,productId:product.id,quantity:5}});
  assert.equal(balance.quantity,5,'stock balance persisted');
  await assert.rejects(db.stockBalance.update({where:{id:balance.id},data:{quantity:-1}}),'negative stock blocked by database');
  const key=randomUUID();
  await db.stockMovement.create({data:{workspaceId,warehouseId:warehouse.id,productId:product.id,quantityDelta:5,quantityAfter:5,reason:'CI seed',idempotencyKey:key,actorUserId:user.id}});
  await assert.rejects(db.stockMovement.create({data:{workspaceId,warehouseId:warehouse.id,productId:product.id,quantityDelta:5,quantityAfter:10,reason:'duplicate',idempotencyKey:key,actorUserId:user.id}}),'idempotency unique constraint');
  const actual=await db.stockBalance.findUnique({where:{warehouseId_productId:{warehouseId:warehouse.id,productId:product.id}}});
  assert.equal(actual?.quantity,5,'constraint failure preserves stock');
  console.log('Stock DB integrity checks PASS');
}finally {
  if(workspaceId)await db.workspace.delete({where:{id:workspaceId}});
  await db.user.deleteMany({where:{email:'stock-ci-'+nonce+'@example.invalid'}});
  await db.$disconnect();
}
