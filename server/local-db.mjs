import {DatabaseSync} from 'node:sqlite';
export function openDatabase(filename=':memory:') {
  const raw=new DatabaseSync(filename);raw.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const adapt=(sql,values=[])=>({sql,values,
    bind(...args){return adapt(sql,args);},
    async first(column){const row=raw.prepare(sql).get(...values);return column?row?.[column]??null:row??null;},
    async all(){return {results:raw.prepare(sql).all(...values),success:true};},
    async run(){const r=raw.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
  });
  return {raw,prepare:sql=>adapt(sql),
    async batch(statements){raw.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements){const q=raw.prepare(s.sql);if(q.columns().length)results.push({results:q.all(...s.values),success:true});else{const r=q.run(...s.values);results.push({success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}});}}raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}},
    close(){raw.close();}
  };
}
