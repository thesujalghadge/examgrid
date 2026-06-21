## Mismatch Audit Report

### Q1 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q1_crop.jpg
**2. Teacher Key:** B
**3. Model Answer:** C
**4. Full Reasoning:**
1. Total numbers: 50. Multiples of 3: floor(50/3) = 16. Non-multiples of 3: 50 - 16 = 34. 2. Total ways to choose 2 distinct numbers: C(50, 2) = (50*49)/2 = 1225. 3. The product ab is divisible by 3 if at least one of them is a multiple of 3. 4. Use complementary counting: The product is NOT divisible by 3 if BOTH a and b are NOT multiples of 3. 5. Number of ways to choose 2 numbers such that neither is a multiple of 3: C(34, 2) = (34*33)/2 = 17*33 = 561. 6. Number of ways such that the product IS divisible by 3: Total - Complement = 1225 - 561 = 664. 7. Probability = 664/1225.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q2 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q2_crop.jpg
**2. Teacher Key:** D
**3. Model Answer:** B
**4. Full Reasoning:**
1. The sum of all probabilities in a distribution must equal 1.
Summing the probabilities: 0 + 2k + k + 3k + 2k^2 + 2k + (k^2 + k) + 7k^2 = 1
Simplifying: (2+1+3+2+1)*k^2 + (2+1+3+2+1)*k = 1
Actually, re-summing: 
x=0: 0
x=1: 2k
x=2: k
x=3: 3k
x=4: 2k^2
x=5: 2k
x=6: k^2 + k
x=7: 7k^2
Total sum = (2+1+3+2+1)k + (2+1+7)k^2 = 9k + 10k^2 = 1
10k^2 + 9k - 1 = 0
(10k - 1)(k + 1) = 0
Since k must be positive, k = 1/10 = 0.1.
2. We need to find P(3 < x <= 6), which includes x = 4, 5, 6.
P(4) = 2k^2 = 2(0.1)^2 = 0.02
P(5) = 2k = 2(0.1) = 0.2
P(6) = k^2 + k = (0.1)^2 + 0.1 = 0.01 + 0.1 = 0.11
3. P(3 < x <= 6) = 0.02 + 0.2 + 0.11 = 0.33.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q4 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q4_crop.jpg
**2. Teacher Key:** D
**3. Model Answer:** B
**4. Full Reasoning:**
1. The line is given by L: (x-6)/3 = (y-7)/2 = (z-7)/(-2) = k. A general point M on the line is (3k+6, 2k+7, -2k+7).
2. The vector PM is perpendicular to the line's direction vector d = (3, 2, -2). Vector PM = (3k+6-1, 2k+7-2, -2k+7-a) = (3k+5, 2k+5, -2k+7-a).
3. PM . d = 0 => 3(3k+5) + 2(2k+5) - 2(-2k+7-a) = 0 => 9k+15 + 4k+10 + 4k - 14 + 2a = 0 => 17k + 11 + 2a = 0 => k = (-11-2a)/17.
4. Since Q is the image of P, M is the midpoint of PQ. Q = (5, b, c). Midpoint M = ((1+5)/2, (2+b)/2, (a+c)/2) = (3, (2+b)/2, (a+c)/2).
5. Comparing M coordinates: 3k+6 = 3 => 3k = -3 => k = -1.
6. Substitute k=-1 into PM.d=0 => 17(-1) + 11 + 2a = 0 => -6 + 2a = 0 => a = 3.
7. Now find b and c using k=-1: 2k+7 = (2+b)/2 => 2(-1)+7 = (2+b)/2 => 5 = (2+b)/2 => 10 = 2+b => b = 8.
8. -2k+7 = (a+c)/2 => -2(-1)+7 = (3+c)/2 => 9 = (3+c)/2 => 18 = 3+c => c = 15.
9. Finally, a^2 + b^2 + c^2 = 3^2 + 8^2 + 15^2 = 9 + 64 + 225 = 298.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q5 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q5_crop.jpg
**2. Teacher Key:** 6
**3. Model Answer:** 18
**4. Full Reasoning:**
1. Since A is a 3x3 skew-symmetric matrix (A+A^T=0), A = [[0, a, b], [-a, 0, c], [-b, -c, 0]]. 2. The given matrix products are A*[1, -1, 0]^T = [3, 3, 2]^T. Let X = [1, -1, 0]^T. A*X = [0*1 + a*-1 + b*0, -a*1 + 0*-1 + c*0, -b*1 - c*-1 + 0*0]^T = [-a, -a, -b+c]^T. So -a=3, -a=3 (consistent), -b+c=2. Thus a=-3, c-b=2. 3. The second equation A^2 * [1, -1, 0]^T = [-3, 19, -24]^T. We have A*X = [3, 3, 2]^T. Let Y = A*X = [3, 3, 2]^T. A*Y = [-3, 19, -24]^T. [[0, -3, b], [3, 0, c], [-b, -c, 0]] * [3, 3, 2]^T = [3*(-3) + 2b, 3*3 + 2c, -3b - 3c]^T = [-9+2b, 9+2c, -3b-3c]^T. Equating: -9+2b=-3 => 2b=6 => b=3. 9+2c=19 => 2c=10 => c=5. Check c-b=5-3=2 (matches). So A = [[0, -3, 3], [3, 0, 5], [-3, -5, 0]]. 4. A+I = [[1, -3, 3], [3, 1, 5], [-3, -5, 1]]. Det(A+I) = 1(1+25) + 3(3+15) + 3(-15+3) = 26 + 54 - 36 = 44. 5. Calculate det(adj(2adj(A+I))). Let M = A+I, det(M)=44. Expression is det(adj(2*adj(M))). Using det(adj(K)) = (det(K))^(n-1) = (det(K))^2. det(adj(2*adj(M))) = (det(2*adj(M)))^2 = (2^3 * det(adj(M)))^2 = (8 * (det(M))^2)^2 = (8 * 44^2)^2 = 8^2 * 44^4 = 64 * 3748096 = 239878144. 6. We are given the form 2(alpha)3(beta)11(gamma). 239878144 doesn't fit the pattern. Re-evaluating: 'adj(2adj(A+I))'. Note: adj(kA) = k^(n-1)adj(A). adj(2*adj(M)) = 2^2 * adj(adj(M)) = 4 * adj(adj(M)). det(adj(adj(M))) = (det(M))^(n-1)^2 = (det(M))^4. So det(4 * adj(adj(M))) = 4^3 * (det(M))^4 = 64 * 44^4. This is consistent. The string '2(alpha)3(beta)11(gamma)' likely refers to the prime factorization components or a sequence. 239878144 = 2^6 * (4*11)^4 = 2^6 * 2^8 * 11^4 = 2^14 * 11^4. The format is likely 2^alpha * 3^beta * 11^gamma. Here alpha=14, beta=0, gamma=4. Sum = 18.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q8 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q8_crop.jpg
**2. Teacher Key:** A
**3. Model Answer:** D
**4. Full Reasoning:**
Statement I is false because, in a still fluid, pressure is defined everywhere within the bulk of the fluid (hydrostatic pressure), not just at the surface of a solid in contact. Statement II is true because molecules on the liquid surface have higher potential energy compared to those in the interior due to unbalanced attractive forces, and systems naturally tend toward minimum potential energy, which manifests as the phenomenon of surface tension. Thus, Statement I is false and Statement II is true, corresponding to option (D).

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q9 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q9_crop.jpg
**2. Teacher Key:** D
**3. Model Answer:** A
**4. Full Reasoning:**
When the rod moves at a constant terminal velocity v, the gravitational force pulling it down (mg) is balanced by the upward magnetic force (F_m) exerted on the segment of the rod that completes the circuit. The effective length of the rod carrying current is 'l' (the distance between the rails PX and QY). The motional EMF induced in the rod is epsilon = B * l * v. The induced current is I = epsilon / R = (B * l * v) / R. The magnetic force on the rod is F_m = I * l * B = [(B * l * v) / R] * l * B = (B^2 * l^2 * v) / R. Setting F_m = mg for terminal velocity: (B^2 * l^2 * v) / R = mg. Solving for v, we get v = (mg * R) / (B^2 * l^2). Looking at the options provided, there seems to be a notation ambiguity; typically the distance between rails is l, but the options use capital 'L'. If the intended separation is 'l', then the formula is mgR/(B^2l^2). Comparing this to option (A), which is mgR/B^2l^2, it matches perfectly.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q10 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q10_crop.jpg
**2. Teacher Key:** 8
**3. Model Answer:** 16
**4. Full Reasoning:**
1. The moment of inertia (I) for a circular disc of radius R and thickness T is given by I = (1/2) * M * R^2.
2. Mass (M) = Density (rho) * Volume (V) = rho * pi * R^2 * T.
3. Substituting M into the I equation: I = (1/2) * (rho * pi * R^2 * T) * R^2 = (1/2) * rho * pi * T * R^4.
4. Since both discs are made of the same material, density (rho) is constant.
5. Given I1 = I2, then (1/2) * rho * pi * T1 * R1^4 = (1/2) * rho * pi * T2 * R2^4.
6. Simplifying, we get: T1 * R1^4 = T2 * R2^4, which implies T1/T2 = (R2/R1)^4.
7. We are given R1/R2 = 2, so R2/R1 = 1/2.
8. Thus, T1/T2 = (1/2)^4 = 1/16.
9. The problem states T1/T2 = 1/alpha, so 1/alpha = 1/16, which means alpha = 16.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q11 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q11_crop.jpg
**2. Teacher Key:** C
**3. Model Answer:** D
**4. Full Reasoning:**
Let's evaluate each statement:
A: Resonance in chlorobenzene transfers electron density from Cl into the ring, reducing the negative charge on Cl compared to the localized charge in chlorocyclohexane. This statement is false.
B: Due to resonance, the C-Cl bond in chlorobenzene acquires partial double bond character. This statement is true.
C: Because of the sp2 hybridized carbon (more electronegative than sp3) and the resonance effect, the dipole moment is lower, meaning the C-Cl bond is less polar. This statement is true.
D: The partial double bond character shortens the C-Cl bond, not lengthens it. This statement is false.
E: The carbon atom bonded to chlorine in chlorobenzene is part of an aromatic ring and is sp2 hybridized, whereas in chlorocyclohexane, it is sp3 hybridized. This statement is true.
Therefore, the correct statements are B, C, and E.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q13 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q13_crop.jpg
**2. Teacher Key:** D
**3. Model Answer:** C
**4. Full Reasoning:**
Statement I claims that nitrobenzene reacts with CH3COCl/AlCl3 (Friedel-Crafts acylation) to give m-nitroacetophenone. Friedel-Crafts reactions (both alkylation and acylation) do not occur on strongly deactivated rings, such as nitrobenzene, because the electrophile cannot effectively attack the electron-deficient ring. Therefore, Statement I is incorrect. Statement II states that the -NO2 group is a meta-directing and deactivating group. This is a well-established fact in organic chemistry due to the strong electron-withdrawing inductive and resonance effects of the nitro group. Therefore, Statement II is correct.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

### Q15 Mismatch
**1. Question Image:** /uploads/cbt_assets/test_job_pyq1/vision_crops/Q15_crop.jpg
**2. Teacher Key:** 34
**3. Model Answer:** 43
**4. Full Reasoning:**
1. Identification: The violet color in the CHCl3 layer upon treatment with chlorine water indicates the presence of Iodine (I). Therefore, the silver halide precipitate is Silver Iodide (AgI).
2. Molar masses: Ag = 107.87 g/mol (commonly used as 108), I = 127 g/mol. Molar mass of AgI = 108 + 127 = 235 g/mol.
3. Calculation of mass of Iodine: In AgI, the mass of Iodine = (127 / 235) * mass of AgI = (127 / 235) * 0.12 g = 0.06485 g.
4. Percentage calculation: Percentage of Iodine = (mass of iodine / mass of organic compound) * 100 = (0.06485 / 0.15) * 100 = 43.23%.
5. Nearest integer: The value 43.23 rounds to 43.

**5. Final derived mathematical value:** (See reasoning end)
**6. Option values extracted from PDF:** (See image)
---

