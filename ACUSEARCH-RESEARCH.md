# AcuSearch, revised: a first-principles research dossier

*Applying the procedure in your prompt to the survivor-location half of KASUKABE's SIH project. HIMGAURAV (the rainfall-threshold side) already has a defensible gap from the earlier audit; this dossier does the same discipline for AcuSearch — the three-layer smartphone triage funnel — and does not assume that framing survives contact with evidence.*

---

## 1. What the real-world system currently looks like

Buried-victim location after a structural collapse or burial event sits inside a five-technology toolkit that professional Urban Search and Rescue (USAR) teams already carry, standardised enough that manufacturers sell them as one integrated control box: seismic/acoustic listening devices ("geostereophones"), UWB (ultra-wideband) rescue radar, thermal imaging cameras, search cameras (colour and waterproof), and canine teams — used together because each covers the others' blind spots.

- **Geostereophones** turn the collapsed structure itself into a microphone. A rescuer plants sensors 20–30 ft apart and listens for scratching, knocking, or voice. Detection range is roughly 5–25 ft for pure acoustic pickup and 50–150 ft for the vibration that travels through the structure's own material (steel and concrete carry it much further than loose debris).
- **UWB Doppler/impulse radar** (Xaver, Camero, and impulse-radar research chips such as Novelda's X4M200) detects the sub-millimetre chest motion of breathing, so it works on unconscious victims where geostereophones cannot. It is validated field equipment: a Xaver 400 unit reportedly located a trapped woman's breathing during the February 2023 Turkey–Syria earthquake response.
- **RECCO** is the oldest of these: a passive, batteryless harmonic-radar reflector (a diode and antenna, 4 g, no power source) sewn into ski clothing, detected by a directional handheld or helicopter radar. It requires no action from the wearer and cannot run out of battery — but it only helps if the victim was already wearing one before the event.
- **Canines** remain the fastest wide-area screening tool and are what most USAR doctrine leads with; electronics are the follow-up on a hit.
- At the research edge, a 2026 paper demonstrates locating a *stock, unmodified* smartphone under rubble using only its microphone: a rescuer emits directional "dipole" sound fields from four loudspeakers, the victim's phone measures the sound, and the phone reports the computed azimuth back over a radio link. Field trials on a disaster-training site achieved roughly 5° of azimuth error over a 10 m² search area.
- Separately, **Advanced Mobile Location (AML)** is the technology that actually finds most emergency callers today: when a smartphone dials an emergency number, it silently activates GPS/Wi-Fi and pushes the location to the dispatcher over SMS or HTTPS. It needs no app. It is also reported to fail 40–66% of the time even under normal conditions, and by design it only activates for an *active, user-initiated emergency call on a live network* — a precondition a buried, unconscious victim with a dead signal cannot meet.

## 2. What existing solutions already do well

- Geostereophones and canines are cheap-ish, portable, doctrine-proven, and require no cooperation from the victim's equipment.
- UWB radar is the only field-proven way to detect an unconscious victim's vital signs without touching them, and it has a real combat/earthquake track record.
- RECCO removes the battery-life and consciousness problem entirely for anyone wearing a reflector, at the cost of needing to have been equipped in advance.
- AML is already solving the "find a conscious, connected caller" problem at national-standard scale in dozens of countries and is mid-rollout in India — this is not a gap a hackathon team should try to re-solve.
- The 2026 acoustic-azimuth paper proves the *concept* that an everyday, unmodified smartphone can be turned into a locatable beacon without installing anything on it beforehand.

## 3. Documented real-world failures

- Geostereophones need a **conscious, moving, or vocalising** victim and a relatively quiet search environment — useless for the unconscious, and degraded by rescue-site noise (generators, aftershocks, wind).
- UWB radar and RECCO are both **specialist hardware**, carried by a small number of trained national/state disaster-response units, not by the first civilians on scene.
- RF penetration is **medium-dependent in a way most victim-location literature does not test for landslide conditions**: ground-penetrating-radar depth guides put wet clay's radar penetration at roughly a third of dry sand's, and RECCO's own literature states its range drops from 20 m in dry snow to 10 m in wet snow because liquid water absorbs the signal. A prior WiFi/UWB ranging trial under simulated rubble (cited in the HIMGAURAV audit) captured no UWB packets at all beyond 9 m, while WiFi packets still arrived somewhat further — rubble, not saturated soil.
- AML's precondition — an active call on a live network — is exactly what burial and rural signal loss remove first.
- The 2026 acoustic-azimuth method still needs the **victim's phone to transmit a result back over radio** to be useful; that return link inherits the same RF-through-medium problem as everything else once the phone is actually buried rather than resting under open rubble on a training field.

## 4. Root-cause analysis (five whys)

**Observed problem:** rainfall-triggered landslide burial in remote hill terrain (Himachal, North East India) has no documented, working smartphone-based way to locate a buried person.

1. *Why?* — Because the equipment that is actually proven to detect a buried, possibly unconscious person (UWB radar, geostereophones) is specialist hardware held by a small number of NDRF/SDRF units, not by villagers or first civilian responders.
2. *Why does that matter here specifically?* — Because these are exactly the road-fragile, remote sites (the same fragility HIMGAURAV documents) that a specialist team needs hours to days to reach.
3. *Why is that delay fatal for landslides specifically, more than for earthquakes?* — Because a 2009 study of a storm-triggered landslide event in Chuuk, Micronesia found asphyxiation by burial was the cause of death in about 90% of fatalities, regardless of whether the victim was indoors or outdoors when buried — landslide debris (soil, mud, rock) leaves far fewer survivable void spaces than a collapsed building's beams and furniture, which is why earthquake entrapment survival stories routinely stretch to a week or more while landslide burial appears to behave much more like avalanche burial, where survival probability falls from roughly 90% to 25–28% by 35 minutes.
4. *Why can't a smartphone fill that early window on its own?* — Because every phone-based signal (Wi-Fi, Bluetooth, UWB ranging, even the microphone-azimuth method's return link) operates in the 2.4–8 GHz range that is the one most aggressively absorbed by liquid water in soil — the literature above shows roughly a threefold reduction in radar penetration depth for wet clay versus dry sand, and empirically, zero UWB ranging packets beyond 9 m even in dry rubble.
5. *Why has nobody engineered around this specifically?* — Because, as the searches for this dossier confirm, essentially all published victim-location radar and acoustic work is validated in structural rubble, dry-to-moderately-wet snow, or an open disaster-training field — not in water-saturated clay/mud, which is the actual burial medium of a monsoon-triggered landslide. No publicly available study measures detection range, or even whether a signal survives at all, in that specific medium.

**Root constraint:** the physics of RF and (to a lesser extent) acoustic coupling into water-saturated fine-grained soil is a fundamentally worse propagation regime than every medium in which today's victim-location technologies were developed and validated, and nobody has published the link-budget numbers that would tell you whether a phone-based approach is even physically possible there before you try to build one.

## 5. Fake or weak problems to reject outright

- **"Nobody has built a three-layer smartphone triage funnel for landslide rescue."** This is a novelty-of-architecture claim, not a novelty-of-capability claim. WiFi-probe sniffing, acoustic ranging, and offline device mesh are each independently known; stapling them together in one app is an engineering exercise, not evidence that the combination solves a failure mode none of the parts solve alone. **Reject** this as the source of differentiation.
- **"Add AI/ML to classify radar or acoustic signatures."** This is already a crowded, active academic subfield (bioradar feature engineering, debris-flow signal classification via deep learning) — not a gap a hackathon team can meaningfully move, and adding it here would be exactly the "AI because it sounds advanced" pattern your prompt tells me to refuse.
- **"Build a cheaper DIY clone of RECCO."** RECCO's own documentation shows the same water-attenuation problem this dossier is built around, its underlying harmonic-radar approach is patented, and a college team cannot out-engineer forty years of a company's field refinement in a hackathon timeline. Not a real opportunity.
- **"Rely on cellular Advanced Mobile Location for landslide victims."** AML only activates on an active, user-initiated emergency call over a live network — precisely the two things burial and rural signal loss remove first. It is a genuinely good technology, aimed at a different problem.

## 6–7. The genuine gap, with evidence

Stated in the required form:

> Existing victim-location technologies — UWB Doppler radar, seismic/acoustic geostereophones, the RECCO passive reflector, and the emerging phone-microphone acoustic-azimuth method — can detect a buried person in structural rubble, dry-to-moderately-wet snow, or open ground at ranges from several to over a hundred metres. But every one of them is validated in a medium that is drier and/or more heterogeneous (more air voids) than water-saturated clay and mud — the dominant burial medium in India's rainfall-triggered landslides — and RF/acoustic coupling into that specific medium is measurably worse: published GPR depth guides show roughly a threefold reduction in radar penetration for wet clay versus dry sand, and a prior WiFi/UWB ranging trial under simulated rubble found zero UWB packets recovered beyond 9 m even in a drier, more permeable medium than saturated soil. No publicly available study characterises detection range, link budget, or a validated protocol for *any* device-based victim-location method specifically in saturated-soil landslide burial. Meanwhile the equipment that *is* proven — UWB radar, geostereophones — sits with a small number of specialist units typically hours to days from India's remote, road-fragile hill villages, which is exactly where landslide burial's high asphyxiation rate (about 90% of fatalities in one documented storm-triggered event) makes the first hour the one that matters most.

That is a narrow, evidence-backed, falsifiable gap. It is also small enough to be honest about: the gap is a **measurement gap**, not a missing invention.

## 8. Prior art and adjacent research consulted

| **Source**                                                                              | **What it establishes**                                                                                                                                                                         |
| :-------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fire Engineering, "Building Collapse: Rescue Operation's Technical Search Capabilities" | Acoustic (5–25 ft) and seismic (50–150 ft) geostereophone detection ranges in rubble                                                                                                            |
| LEADER / Tempest USAR product literature                                                | The five-peripheral USAR toolkit (SEARCH, SCAN/UWB radar, thermal, colour, waterproof cameras); wireless geostereophone range \~100 m                                                           |
| International Fire Fighter, Turkey/Syria 2023 coverage                                  | Canines, listening devices, and search cameras used as complementary layers in a real large-scale response                                                                                      |
| CAMERO, "Enhancing SAR with UWB Radar"                                                  | Xaver 400 field use in the 2023 Turkey earthquake, detecting a trapped survivor's breathing                                                                                                     |
| Takada et al., *JASA Express Letters* (2026); EurekAlert coverage                       | Stock-smartphone-microphone azimuth localisation via dipole sound fields; 5.04° error over a 10 m² field trial; explicitly needs a radio return-link from the victim's phone                    |
| Ground-penetrating-radar depth guides (sphengineering.com; mineclosure.gtk.fi)          | Wet clay cuts radar depth to roughly a third of dry sand; conductive, water-rich soil is the worst case for RF penetration                                                                      |
| USPTO patent 10,201,278, "Life detecting radars"                                        | Explicit signal-flow diagram showing soil absorption as a distinct, separately-modelled loss term from rubble scatter                                                                           |
| RECCO (Wikipedia; recco.com FAQ; Burton)                                                | Passive harmonic-radar reflector; 20 m dry snow / 10 m wet snow / 8 in. water range; used by 900+ rescue organisations; patented                                                                |
| Human Vulnerability to Landslides, *PMC*                                                | \~90% of fatalities in the 2002 Chuuk, Micronesia storm-triggered landslides were asphyxiation by burial, regardless of indoor/outdoor location                                                 |
| Avalanche survival-curve literature (Eurac Research; SLF; *Resuscitation*)              | Survival falls from \~90% to 25–28% by 35 minutes of burial; a useful proxy for burial-without-void-space physiology                                                                            |
| "Time-to-Rescue" analysis, earthquake entrapment; ABC/AP wire coverage                  | Earthquake rubble entrapment survival routinely extends past a week because of survivable void spaces — the contrast case that makes landslide burial's near-total asphyxiation rate meaningful |
| ETSI/EENA Advanced Mobile Location documentation                                        | AML requires an active, user-initiated emergency call on a live network; 40–66% real-world failure rate even under normal conditions                                                            |
| Lopez-Pastor et al., *Sensors* (2022) — cited in the HIMGAURAV audit                    | Empirical UWB/WiFi ranging trial under simulated rubble: zero UWB packets captured beyond 9 m                                                                                                   |

## 9. Why existing methods still fall short, specifically for this deployment

Every method above was engineered and tested against a medium — air, rubble, or snow — that is more radio- and sound-transparent than saturated monsoon soil. None of the vendors or papers claim their stated ranges hold in wet clay, and the adjacent physics (GPR depth guides, RECCO's own wet-snow derating) all points the same direction: worse, not merely "unknown." The honest position is that nobody has shown it *fails* in this medium either — the literature is simply silent, which is itself the finding.

## 10. Engineering requirements, if this gap is pursued

**Must have**

- Establishes, before any app is built, whether a phone-emitted signal (Wi-Fi RSSI, BLE advertisement, UWB ranging, or an audible tone) is detectable at all through realistic local soil at realistic moisture content and burial depth.
- Reports results as a link budget (received signal strength or detection probability vs. lateral distance, for each modality, at each depth) — not a single go/no-go number.
- Uses soil actually representative of the deployment region (Himachal/NER monsoon clay, not generic potting soil).

**Should have**

- Tests at burial depths matching documented shallow-failure geometry (\~2 m, per the Mizoram frictional-timescales literature already used in HIMGAURAV) rather than an arbitrary depth.
- Compares a phone-only signal against a cheap, physical add-on (e.g., a low-cost passive reflector or a wired probe microphone) to see whether a small hardware addition changes the answer qualitatively.

**Nice to have**

- Multi-moisture-content sweep (dry, damp, saturated) to characterise how fast the signal degrades as the same soil gets wetter during a storm.

## 11–12. Solution architectures considered, and how each was attacked

**A — Ship the original three-layer app anyway (WiFi-probe sniffing + acoustic ranging + device mesh).** Killed by Phase 5: none of the individual layers is new, the combination adds no demonstrated capability the parts don't already have separately, and it does not confront the wet-soil attenuation problem at all — it just assumes the RF/acoustic link exists.

**B — Build a phone-based detector claiming a specific range in landslide debris.** Killed on evidence: no source supports any range claim in saturated soil. Publishing an unverified range would repeat exactly the fabrication problem the HIMGAURAV audit already flagged and removed once (the "91.2% accuracy" incident).

**C — Adapt Takada et al.'s acoustic-azimuth method, but replace its RF return-link with a physical wired probe (borrowing the geostereophone's approach) specifically so the "read-back" step doesn't have to survive the same wet-soil RF penalty as the "ping" step.** Survives longer under attack: it is a plausible, cheap, testable modification, but its central premise — that the *outbound* dipole sound field still reaches the phone's microphone through saturated soil at a useful range — is untested, so it inherits the measurement gap rather than closing it.

**D — Run the soil-pit characterisation experiment first, publish the link budget, and only then decide whether A, B, or C (or nothing) is buildable.** This is the option that survives every attack, because it makes no claim the evidence doesn't support yet.

## 13. Novelty matrix

| **Capability**                      | **Geostereophone**                       | **UWB radar**                        | **RECCO**                     | **Takada et al. 2026 (phone mic)** | **Proposed: soil-pit link budget**    |
| :---------------------------------- | :--------------------------------------- | :----------------------------------- | :---------------------------- | :--------------------------------- | :------------------------------------ |
| Works on unconscious victim         | No                                       | Yes                                  | Yes                           | Unclear (needs phone functional)   | N/A — measurement study               |
| Needs pre-event equipment on victim | No                                       | No                                   | Yes (reflector)               | No                                 | No                                    |
| Validated medium                    | Rubble                                   | Rubble, walls                        | Snow, air                     | Open training field                | Saturated clay/mud (proposed)         |
| Approx. range where validated       | 1.5–7.6 m (acoustic) / 15–45 m (seismic) | Several m, unpublished exact figures | 20 m dry snow / 10 m wet snow | 5° error, 10 m² field              | To be measured                        |
| Rescuer equipment cost              | Moderate, specialist                     | High, specialist                     | Moderate, specialist          | Low (4 speakers + phone)           | Near-zero                             |
| Validated in wet clay/mud burial    | **NOT VERIFIED — no source found**       | **NOT VERIFIED**                     | **NOT VERIFIED**              | **NOT VERIFIED**                   | *This is the point of the experiment* |

**Classification:** the geostereophone, UWB radar, RECCO, and phone-acoustic-azimuth method are all **known components**. The original three-layer AcuSearch pitch is a **known combination**. Replacing the acoustic method's RF return-link with a wired probe (Option C) is a **potentially novel integration** — I could not find it published, but a hackathon-scale search is not exhaustive, so this is an unverified-novelty claim, not a confirmed one. No new physical sensing mechanism is proposed anywhere in this dossier, and none should be claimed.

## 14. Minimum viable proof-of-concept experiment

**Goal:** find out, at near-zero cost, whether any phone-based signal survives realistic landslide burial at all — before writing a line of app code.

- **Setup:** 3–4 buckets or a shallow soil pit, filled with local clay-rich soil at controlled moisture content (dry, damp, saturated — achievable by weighing dry soil, adding a measured volume of water, and letting it settle).
- **Devices under test, buried at 0.3 m, 0.6 m, 1.0 m, and 1.5 m:**
  - A phone broadcasting a BLE advertisement and a 2.4 GHz Wi-Fi probe.
  - A phone playing a fixed 1–3 kHz tone (matching the audible band Takada et al. use) at a known volume.
  - A simple contact microphone or piezo tapper, wired out (the geostereophone control case).
- **Measurement:** at the surface, walk a receiver phone (RSSI logger app) and a directional microphone outward from 0 to 15 m in 1 m steps, recording received signal strength or detectability for each modality, each depth, each moisture level.
- **Control case:** repeat with the same devices resting on the surface, unburied, to establish the baseline before soil is added as a variable.
- **Failure criterion:** if BLE/Wi-Fi RSSI drops below the noise floor by 1 m of saturated burial, that modality is disqualified for this application regardless of anything built on top of it.

This is genuinely the cheapest experiment that can validate or kill the whole premise, and it produces a publishable result — the link-budget table — either way.

## 15. Metrics that would prove success

- Detection range (m) at 50% and 90% detection probability, per modality, per depth, per moisture content.
- Minimum burial depth at which each modality's signal falls below a usable threshold.
- Comparison against the 9 m dry-rubble UWB ceiling already documented in the literature, to show whether saturated soil is better, worse, or comparable.

## 16. Research questions still unanswered

- Does audible sound (the Takada et al. channel) degrade less sharply than RF in saturated soil, given that acoustic impedance and RF permittivity respond differently to water content? Not established by anything found in this search.
- At what moisture content does the medium transition from "attenuating but usable" to "effectively opaque"? No threshold is published for any of these modalities in soil specifically.
- Does burial depth or soil density matter more? The GPR literature suggests density and clay fraction, not depth alone, dominate — untested for phone-band frequencies specifically.

## 17. Claims that are VERIFIED (by the sources in section 8)

- Geostereophone and UWB radar detection ranges and use cases, as field-deployed USAR equipment.
- RECCO's passive, batteryless operation and its dry-snow/wet-snow/water range derating.
- The Takada et al. 2026 phone-microphone azimuth method and its measured 5° error in an open training field.
- \~90% asphyxiation rate in the 2002 Chuuk landslide fatalities; the earthquake-rubble long-survival contrast case.
- AML's dependence on an active emergency call over a live network, and its 40–66% real-world failure rate.
- Wet clay reduces GPR/radar penetration depth relative to dry sand by roughly a factor of three, per multiple independent GPR depth-guide sources.
- Zero UWB ranging packets recovered beyond 9 m in a prior simulated-rubble trial.

## 18. Claims that are PLAUSIBLE BUT UNVERIFIED

- That the same wet-soil RF penalty measured for GPR/UWB in general soil-science literature applies at the same magnitude to phone-band Wi-Fi/BLE/UWB specifically, in landslide-representative clay, at realistic burial depths. Physically consistent, but not directly measured by any source found here.
- That a wired-probe read-back (Option C) would meaningfully outperform an RF return-link in this medium. Plausible by analogy to geostereophones, not demonstrated.

## 19. Claims that should NOT be made

- Any specific detection-range number for a smartphone-based method in landslide burial. **No source supports one.**
- That the three-layer AcuSearch funnel is a novel architecture. It is a known combination of known parts.
- That this approach "detects" survivors. At best, until the experiment in Section 14 is run, it can only be described as *proposed* and *experimental* — exactly the discipline the HIMGAURAV rebuild already applied to the rest of the project.

## 20. Final defensible problem statement

> For rainfall-triggered landslides in road-fragile hill terrain (Himachal Pradesh and North East India), the equipment proven to detect a buried survivor — UWB life-detection radar, seismic geostereophones — is concentrated in a small number of national and state disaster-response units that typically cannot reach a remote village site within the first hour or two, which is precisely the window in which landslide burial's high documented asphyxiation rate makes detection matter most. No publicly available study establishes whether *any* smartphone-emitted signal — Wi-Fi, Bluetooth, UWB, or audible sound — is even detectable through the water-saturated clay and mud that characterises these burials, at what range, or at what depth. The genuine, honest contribution available to a student team is not another detection app: it is the soil-pit link-budget experiment in Section 14, run on locally representative monsoon soil, published regardless of which way the numbers fall.

---

### What this means for the SIH pitch

Presenting the measurement gap itself — "here is what nobody has published, here is the cheap experiment that answers it, here is what we found" — is a stronger, more defensible hackathon story than presenting an app built on an unverified physical premise. It also matches HIMGAURAV's own standing rule: *truth over impressiveness, function over decoration, explainability over fake AI.* If the soil-pit numbers come back genuinely unusable for every phone-based modality, that is a legitimate, citable finding — "no meaningful gap exists here for phone-based detection; the honest recommendation is investment in more geostereophones and UWB units at the district level, not an app" is a real conclusion a judge will respect, and a better outcome than a demo built on physics nobody checked.