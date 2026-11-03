import {it, expect} from "vitest";
import {previewParameters} from "./hooks/useStagePreviews";
import {collectTestParameters} from "./parameters";
it("fonte dados do canvas 57 mantém a unidade da origem",()=>{
  const source = {id:"dados",type:"report" as const,report_id:57};
  const schema = {unidade:{type:"string",required:false,default:"ame",choices:[{label:"AME Votuporanga",value:"ame"}]}};
  const result=previewParameters(source,schema,{},"scv");
  expect(collectTestParameters(result.fields,result.values)).toEqual({unidade:"ame"});
});
