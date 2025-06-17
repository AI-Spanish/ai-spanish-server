import db from "@/db";
import * as schema from "./schema";

async function insertData(schema: any, data: any) {
  for (let item of data) {
    await db
      .insert(schema)
      .values(item)
      .onConflictDoUpdate({ target: schema.id, set: item });
  }
}

import wordBooks from "../../public/wordBooks.json";
await insertData(schema.wordBook, wordBooks);
console.log('[success] wordBooks complete.');

import DELE_A1 from '../../public/DELE_A1/DELE_A1.json';
import DELE_A1_inBook from '../../public/DELE_A1/DELE_A1_inBook.json';
await insertData(schema.word, DELE_A1);
await insertData(schema.wordInBook, DELE_A1_inBook);
console.log('[success] DELE_A1 complete.');

import modernSpanish from '../../public/modernSpanish/modernSpanish.json';
import modernSpanish_inBook from '../../public/modernSpanish/modernSpanish_inBook.json';
await insertData(schema.word, modernSpanish);
await insertData(schema.wordInBook, modernSpanish_inBook);
console.log('[success] modernSpanish complete.');

import NewMiddleSchool from '../../public/NewMiddleSchool/NewMiddleSchool.json';
import NewMiddleSchool_inBook from '../../public/NewMiddleSchool/NewMiddleSchool_inBook.json';
await insertData(schema.word, NewMiddleSchool);
await insertData(schema.wordInBook, NewMiddleSchool_inBook);
console.log('[success] NewMiddleSchool complete.');

import middleSchoolStandard from '../../public/middleSchoolStandard/middleSchoolStandard.json';
import middleSchoolStandard_inBook from '../../public/middleSchoolStandard/middleSchoolStandard_inBook.json';
await insertData(schema.word, middleSchoolStandard);
await insertData(schema.wordInBook, middleSchoolStandard_inBook);
console.log('[success] middleSchoolStandard complete.');

console.log("Seeding complete.");
