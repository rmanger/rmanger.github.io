// General, plain-language context for out-of-range results. Not a diagnosis.
// Each entry: [why it may be, what can help]. Keyed by marker name, then 'high' (above range) / 'low' (below range).
const ADVICE = (() => {
  const A = {};
  const set = (names, o) => names.split('|').forEach((n) => { A[n] = o; });

  set('TFT (TSH)', {
    high: ['Often an underactive thyroid; can also follow illness or some medicines.', 'Repeat with free T4 and thyroid antibodies; your doctor decides whether treatment is needed.'],
    low: ['Can mean an overactive thyroid, too much thyroid medication, or biotin supplements.', 'Check free T4/T3 and pause biotin for a few days before retesting.'] });
  set('C Reactive Protein (hsCRP)', {
    high: ['A sign of inflammation: recent infection or injury, poor sleep, smoking, excess weight, or a chronic condition.', 'Retest when well (2+ weeks after an illness). Sleep, regular exercise, not smoking and a healthy weight lower it.'] });
  set('Parathyroid Hormone (PTH)', {
    high: ['Commonly low vitamin D or calcium, kidney problems, or an overactive parathyroid gland.', 'Check vitamin D, calcium and kidney function; correcting low vitamin D often helps.'],
    low: ['May reflect high calcium or low magnesium.', 'Check calcium and magnesium with your doctor.'] });
  set('Vitamin B12', {
    low: ['Low intake (little animal food), poor absorption, or medicines such as metformin or reflux tablets.', 'A B12 supplement or injections, once your doctor checks the cause.'],
    high: ['Usually recent B12 supplements or injections; occasionally liver conditions.', 'Review supplements and retest if unexplained.'] });
  set('Insulin', {
    high: ['Often insulin resistance: excess weight, low activity, poor sleep, or a non-fasting sample.', 'Retest fasting; regular activity, weight loss if relevant and fewer refined carbs help. Review with glucose/HbA1c.'],
    low: ['Can be a long fast, or reduced insulin production.', 'Interpret alongside glucose and HbA1c with your doctor.'] });
  set('Prostate Specific AG', {
    high: ['Prostate enlargement or inflammation, a recent infection, cycling, ejaculation or exam; less often cancer.', 'Repeat after 48 hours without ejaculation or cycling. Your doctor may refer you to a urologist if it stays high.'] });
  set('HbA1c (mmol/mol)|HbA1c (%)', {
    high: ['Average blood sugar has been raised over ~3 months (prediabetes or diabetes range).', 'Confirm with a fasting glucose; activity, weight, fibre-rich food and fewer sugary drinks help. Your doctor will advise.'],
    low: ['Can follow recent blood loss, anaemia, or some haemoglobin variants, which make HbA1c read low.', 'Check a full blood count with your doctor.'] });
  set('Glucose', {
    high: ['Not fasting, stress or illness, or prediabetes/diabetes.', 'Repeat fasting (8+ hours) and add an HbA1c.'],
    low: ['A long fast, some medicines, or reactive low blood sugar after meals.', 'Regular meals with protein and fibre; tell your doctor if you have symptoms.'] });
  set('Vitamin D', {
    low: ['Little sun exposure, darker skin, covering clothing, or mostly indoor life.', 'Safe sun exposure and a supplement dose your doctor recommends; retest in ~3 months.'],
    high: ['Usually over-supplementing.', 'Reduce the supplement and check calcium with your doctor.'] });

  set('Total|LDL|Non-HDL', {
    high: ['Saturated fat in the diet, genetics, an underactive thyroid, or excess weight.', 'Less saturated fat, more fibre, plants and nuts, regular exercise. Your doctor can assess overall heart risk and whether medication is useful.'] });
  set('HDL', {
    low: ['Low activity, smoking, excess weight, or a high refined-carb diet.', 'Regular aerobic exercise, quitting smoking and swapping to healthy fats raise HDL.'] });
  set('Triglyceride', {
    high: ['Alcohol, sugary foods and drinks, a non-fasting sample, excess weight, or raised blood sugar.', 'Repeat fasting; cut alcohol and sugar, exercise regularly, and fish or omega-3 foods help.'] });

  set('Haemoglobin|RBC|HCT', {
    low: ['Iron, B12 or folate deficiency, blood loss, or a chronic condition.', 'Check iron studies, B12 and folate and look for a cause with your doctor.'],
    high: ['Dehydration, smoking, sleep apnoea, high altitude or testosterone treatment.', 'Hydrate and repeat; your doctor may look for a cause if it persists.'] });
  set('MCV|MCH|MCHC|RDW', {
    high: ['Often B12/folate deficiency, alcohol, or an underactive thyroid (RDW: mixed deficiencies).', 'Check B12, folate, thyroid and alcohol intake with your doctor.'],
    low: ['Commonly iron deficiency or an inherited trait such as thalassaemia.', 'Check iron studies; a doctor can advise on treatment.'] });
  set('WCC|Neutrophils|Lymphocytes', {
    high: ['Infection, inflammation, stress, smoking, or steroid medicines.', 'Repeat when well; your doctor may investigate if it stays high.'],
    low: ['Often a recent viral illness, some medicines, or normal variation.', 'Repeat in a few weeks when well; mention any frequent infections to your doctor.'] });
  set('Monocytes|Eosinophils|Basophils', {
    high: ['Recovering infection, inflammation, or allergy (eosinophils: allergy, asthma, parasites).', 'Repeat when well; see your doctor if it persists or you have symptoms.'] });
  set('PLATELETS', {
    high: ['Inflammation, infection recovery or iron deficiency.', 'Repeat when well and check iron levels.'],
    low: ['Viral illness, alcohol, some medicines, or a lab clumping artefact.', 'Repeat the test; see your doctor if it stays low or you bruise easily.'] });

  set('Sodium|Potassium|Chloride|Bicarbonate', {
    high: ['Dehydration, some medicines, kidney function, or (potassium) a sample that sat too long.', 'Drink fluids and repeat the test; review medicines with your doctor.'],
    low: ['Too much water, vomiting or diarrhoea, or diuretic medicines.', 'Review fluids and medicines with your doctor and repeat.'] });
  set('Urea|Creatinine', {
    high: ['Dehydration, high-protein diet, creatine supplements, large muscle mass, or reduced kidney function.', 'Hydrate, pause creatine, and repeat with eGFR; your doctor can check kidney function.'],
    low: ['Low protein intake or low muscle mass.', 'Usually not a concern; discuss if unexpected.'] });
  set('eGFR', {
    low: ['Reduced filtering by the kidneys, or dehydration at the time.', 'Repeat with a urine albumin/creatinine test; blood pressure control and hydration protect kidneys.'] });
  set('T.Protein|Albumin|Globulin', {
    high: ['Dehydration, or chronic inflammation or infection (globulin).', 'Hydrate and repeat; your doctor may add further tests.'],
    low: ['Inflammation, liver or kidney conditions, or low protein intake.', 'Discuss with your doctor with liver and kidney tests.'] });
  set('ALP', {
    high: ['Liver or bile duct issues, or bone growth and healing.', 'Check liver tests alongside GGT; your doctor can advise on the cause.'] });
  set('GGT|AST|ALT', {
    high: ['Alcohol, fatty liver, medicines or supplements, hard exercise before the test, or viral hepatitis.', 'Avoid alcohol and heavy exercise for 48 hours before retesting; review medicines and supplements. Persistent rises may need a liver ultrasound and hepatitis screen.'] });
  set('Bilirubin', {
    high: ['Often Gilbert\'s syndrome (common and harmless), fasting, or red cell breakdown; less often liver or bile duct issues.', 'Repeat and ask for split (direct/indirect) bilirubin.'] });
  set('Urate', {
    high: ['Alcohol (especially beer), red meat, sugary drinks, dehydration, or a gout tendency.', 'Hydrate, cut alcohol and sugary drinks, and manage weight; see your doctor if you get joint attacks.'] });

  set('Iron|Transferrin|Saturation', {
    high: ['A recent iron supplement or meal before the test, or too much iron stored in the body.', 'Retest fasting without iron supplements; high saturation may prompt an iron overload check.'],
    low: ['Iron deficiency from diet, blood loss or poor absorption.', 'Check ferritin and find the cause; iron-rich foods or supplements as your doctor advises.'] });
  set('Ferritin', {
    high: ['Inflammation, fatty liver or alcohol use, or iron overload (e.g. haemochromatosis).', 'Retest fasting with transferrin saturation; avoid iron/vitamin C supplements and limit alcohol. If iron overload is confirmed, regular blood removal is the usual treatment.'],
    low: ['Depleted iron stores.', 'Find the cause with your doctor and replace iron.'] });
  set('Albumin Conc.|Creat. Conc.|ACR', {
    high: ['Kidney strain from blood pressure or diabetes, hard exercise, infection, or concentrated urine before the test.', 'Repeat with an early-morning sample, well hydrated and after a rest day; check blood pressure.'] });

  const FALLBACK = {
    high: ['Results above range can reflect a real change, recent illness, medicines or supplements, diet, or dehydration.', 'Repeat under the same conditions and review medicines with your doctor.'],
    low: ['Results below range can reflect a real change, recent illness, diet, or normal variation.', 'Repeat under the same conditions and review with your doctor.'] };
  return (name, dir) => (A[name] && A[name][dir]) || FALLBACK[dir];
})();
