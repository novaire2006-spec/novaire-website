import test from 'node:test';
import assert from 'node:assert/strict';
import { BETA_DEADLINE, BETA_ENDPOINT, BETA_PRIVACY_VERSION, countdownParts, validateApplication } from '../public/beta-core.js';

const valid = {
  name: 'Alex', age: '18', email: 'qa@example.invalid', source: 'friends',
  sourceDetail: '', motivation: 'Ich möchte die App ausprobieren und hilfreiches Feedback zum Lernen geben.',
  device: 'iPhone 15', grade: '', availability: '', applicantKind: 'self', consent: true, website: '',
};

test('Beta cutoff covers the whole 30 October in Berlin, never goes negative', () => {
  assert.equal(BETA_DEADLINE, Date.parse('2026-10-30T23:00:00Z'));
  assert.equal(BETA_ENDPOINT, 'https://naafzrrhjsfaqqrnhrcn.supabase.co/functions/v1/beta-application');
  assert.equal(BETA_PRIVACY_VERSION, '2026-10-beta-v1');
  assert.deepEqual(countdownParts(BETA_DEADLINE - 90_061_000), {closed:false,days:1,hours:1,minutes:1,seconds:1});
  assert.deepEqual(countdownParts(BETA_DEADLINE - 1), {closed:false,days:0,hours:0,minutes:0,seconds:1});
  assert.deepEqual(countdownParts(BETA_DEADLINE), {closed:true,days:0,hours:0,minutes:0,seconds:0});
  assert.deepEqual(countdownParts(BETA_DEADLINE + 5000), {closed:true,days:0,hours:0,minutes:0,seconds:0});
});

test('Valid adult payload normalizes plain fields, does not invent optional details', () => {
  const {errors,payload} = validateApplication({...valid,name:' Alex ',email:' qa@example.invalid ',sourceDetail:'ignored for non-other source'});
  assert.deepEqual(errors,{});
  assert.equal(payload.name,'Alex');
  assert.equal(payload.email,'qa@example.invalid');
  assert.equal(payload.age,18);
  assert.equal(payload.grade,null);
  assert.equal(payload.availability,null);
  assert.equal(payload.sourceDetail,'');
  assert.equal(payload.privacyVersion,BETA_PRIVACY_VERSION);
  assert.equal(payload.consent,true);
});

test('Under 16 requires an explicitly chosen guardian, not a client-claimed self application', () => {
  for (const age of ['10','14','15']) {
    assert.ok(validateApplication({...valid,age}).errors.applicantKind);
    assert.deepEqual(validateApplication({...valid,age,applicantKind:'guardian'}).errors,{});
  }
  assert.deepEqual(validateApplication({...valid,age:'16'}).errors,{});
  assert.ok(validateApplication({...valid,age:'14',applicantKind:''}).errors.applicantKind);
});

test('Invalid ages, lengths, email, enums and consent are rejected without coercion', () => {
  const cases = [
    ['name',''],['name','x'],['name','x'.repeat(81)],
    ['age','9'],['age','100'],['age','14.5'],['age','1e1'],['age','NaN'],
    ['email','not-an-email'],['email','a@b'],['email','a b@example.invalid'],
    ['source','unknown'],['motivation','short'],['motivation','x'.repeat(2001)],
    ['device','x'.repeat(81)],['grade','4'],['grade','14'],['grade','10.5'],
    ['availability','always'],['applicantKind','admin'],['consent',false],['consent','true'],
  ];
  for (const [field,value] of cases) assert.ok(validateApplication({...valid,[field]:value}).errors[field], `${field} rejects ${String(value).slice(0,30)}`);
  assert.ok(validateApplication({...valid,source:'other',sourceDetail:'x'.repeat(151)}).errors.sourceDetail);
});

test('Optional answers use the exact backend contract and plain text stays plain', () => {
  const {errors,payload} = validateApplication({...valid,source:'other',sourceDetail:'Von einem Freund ',grade:'13',availability:'several_weekly',name:'<b>Alex</b>'});
  assert.deepEqual(errors,{});
  assert.equal(payload.sourceDetail,'Von einem Freund');
  assert.equal(payload.grade,13);
  assert.equal(payload.availability,'several_weekly');
  assert.equal(payload.name,'<b>Alex</b>');
  assert.deepEqual(Object.keys(payload).sort(),['age','applicantKind','availability','consent','device','email','grade','motivation','name','privacyVersion','source','sourceDetail','website'].sort());
});
