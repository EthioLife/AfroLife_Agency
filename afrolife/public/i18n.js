const rows = [
  ['Sign out', 'ውጣ', 'Ba’i', 'ውፃእ'],
  ['AfroLife home', 'የAfroLife መነሻ', 'Fuula jalqabaa AfroLife', 'መበገሲ ገጽ AfroLife'],
  ['More', 'ተጨማሪ', 'Dabalata', 'ተወሳኺ'],
  ['More workspace sections', 'ተጨማሪ የሥራ ቦታ ክፍሎች', 'Kutaa hojii dabalataa', 'ተወሳኺ ክፍልታት ቦታ ስራሕ'],
  ['YOUR WORKSPACE', 'የእርስዎ የሥራ ቦታ', 'IDDOO HOJII KEESSAN', 'ቦታ ስራሕኩም'],
  ['All sections', 'ሁሉም ክፍሎች', 'Kutaa hunda', 'ኩሎም ክፍልታት'],
  ['Close', 'ዝጋ', 'Cufi', 'ዕጸው'],
  ['Close workspace sections', 'የሥራ ቦታ ክፍሎችን ዝጋ', 'Kutaa hojii cufi', 'ክፍልታት ቦታ ስራሕ ዕጸው'],
  ['PEOPLE · SERVICES · OPPORTUNITY', 'ሰዎች · አገልግሎቶች · ዕድል', 'Namoota · Tajaajila · Carraa', 'ሰባት · ኣገልግሎታት · ዕድል'],
  ['One trusted place to get work moving.', 'ሥራን ለማስኬድ አንድ የታመነ ቦታ።', 'Bakka amanamaa hojii itti jalqabsiisan.', 'ስራሕ ንምንቅስቓስ ሓደ ዝተኣመነ ቦታ።'],
  ['Coordinate leads, verified workers and service requests with clear ownership at every step.', 'ደንበኞችን፣ የተረጋገጡ ሠራተኞችን እና የአገልግሎት ጥያቄዎችን በእያንዳንዱ ደረጃ ግልጽ ኃላፊነት ባለው መንገድ ያስተባብሩ።', 'Maamiltoota, hojjettoota mirkanaa’an fi gaaffii tajaajilaa tarkaanfii hunda irratti itti gaafatamummaa ifa ta’een qindeessaa.', 'Ma’amilaat፣ ዝተረጋገጹ ሰራሕተኛታትን ሕቶታት ኣገልግሎትን ኣብ ነፍሲ ወከፍ ደረጃ ግልጺ ሓላፍነት ብዘለዎ መንገዲ ኣወሃህዱ።'],
  ['Verified workforce', 'የተረጋገጠ የሠራተኛ ኃይል', 'Hojjettoota mirkanaa’an', 'ዝተረጋገጸ ሓይሊ ሰራሕተኛ'],
  ['Accountable agent network', 'ተጠያቂነት ያለው የወኪሎች መረብ', 'Neetworkii bakka bu’oota itti gaafatamummaa qabu', 'ተሓታትነት ዘለዎ መርበብ ወከልቲ'],
  ['Central matching oversight', 'ማዕከላዊ የማዛመድ ቁጥጥር', 'To’annoo walitti fiduu giddugaleessaa', 'ማእከላዊ ቁጽጽር ምዝማድ'],
  ['SECURE WORKSPACE', 'ደህንነቱ የተጠበቀ የሥራ ቦታ', 'Iddoo hojii nageenya qabu', 'ውሑስ ቦታ ስራሕ'],
  ['Welcome back', 'እንኳን ደህና መጡ', 'Baga nagaan deebiitan', 'እንቋዕ ብደሓን ተመለስኩም'],
  ['Sign in with your registered Ethiopian phone number.', 'በተመዘገበው የኢትዮጵያ ስልክ ቁጥርዎ ይግቡ።', 'Lakkoofsa bilbilaa Itoophiyaa galmeessitan fayyadamuun seenaa.', 'ብዝተመዝገበ ቁጽሪ ስልኪ ኢትዮጵያ እቶ።'],
  ['Phone number', 'ስልክ ቁጥር', 'Lakkoofsa bilbilaa', 'ቁጽሪ ስልኪ'],
  ['Password', 'የይለፍ ቃል', 'Jecha icciitii', 'መሕለፊ ቃል'],
  ['Authenticator code', 'የማረጋገጫ ኮድ', 'Koodii mirkaneessaa', 'ኮድ መረጋገጺ'],
  ['Sign in', 'ግባ', 'Seeni', 'እቶ'],
  ['Access is limited to approved AfroLife accounts.', 'መዳረሻው ለተፈቀዱ የAfroLife መለያዎች ብቻ ነው።', 'Seensaan herrega AfroLife hayyamame qofaaf daangeffama.', 'መእተዊ ንዝተፈቕደሎም ሕሳባት AfroLife ጥራይ ዝተወሰነ እዩ።'],
  ['API server address', 'የAPI አገልጋይ አድራሻ', 'Teessoo sarvarii API', 'ኣድራሻ ሰርቨር API'],
  ['Save server address', 'የአገልጋይ አድራሻ አስቀምጥ', 'Teessoo sarvarii olkaa’i', 'ኣድራሻ ሰርቨር ዓቅብ'],
  ['Change server', 'አገልጋይ ቀይር', 'Sarvarii jijjiiri', 'ሰርቨር ቀይር'],
  ['ETHIOLIFE OPERATIONS', 'የETHIOLIFE ሥራ አስተዳደር', 'HOJII ETHIOLIFE', 'ስራሕ ETHIOLIFE'],
  ['Your workspace', 'የእርስዎ የሥራ ቦታ', 'Iddoo hojii keessan', 'ቦታ ስራሕኩም'],
  ['Refresh', 'አድስ', 'Haaromsi', 'ኣሐድስ'],
  ['Workspace sections', 'የሥራ ቦታ ክፍሎች', 'Kutaa iddoo hojii', 'ክፍልታት ቦታ ስራሕ'],
  ['Overview', 'አጠቃላይ እይታ', 'Cuunfaa', 'ሓፈሻዊ ርእይቶ'],
  ['Leads', 'ደንበኞች', 'Maamiltoota', 'መራሕቲ'],
  ['Workers', 'ሠራተኞች', 'Hojjettoota', 'ሰራሕተኛታት'],
  ['Requests & matching', 'ጥያቄዎች እና ማዛመድ', 'Gaaffii fi walitti fiduu', 'ሕቶታትን ምዝማድን'],
  ['Security', 'ደህንነት', 'Nageenya', 'ድሕነት'],
  ['Admin & review', 'አስተዳደር እና ግምገማ', 'Bulchiinsa fi gamaaggama', 'ምምሕዳርን ግምገማን'],
  ['Secure operations · Addis Ababa, Ethiopia', 'ደህንነቱ የተጠበቀ ሥራ · አዲስ አበባ፣ ኢትዮጵያ', 'Hojii nageenya qabu · Finfinnee, Itoophiyaa', 'ውሑስ ስራሕ · ኣዲስ ኣበባ፣ ኢትዮጵያ'],
  ['Your activity', 'የእርስዎ እንቅስቃሴ', 'Sochii keessan', 'ንጥፈታትኩም'],
  ['Your latest records and work in progress.', 'የቅርብ ጊዜ መዝገቦችዎ እና በሂደት ላይ ያሉ ሥራዎች።', 'Galmeewwan dhiheenyaa fi hojii adeemsarra jiru.', 'ናይ ቀረባ ግዜ መዝገባትኩምን ኣብ ምክያድ ዘሎ ስራሕን።'],
  ['No activity yet. Start by registering a lead or worker.', 'እስካሁን ምንም እንቅስቃሴ የለም። ደንበኛ ወይም ሠራተኛ በመመዝገብ ይጀምሩ።', 'Ammaaf sochiin hin jiru. Maamila yookaan hojjetaa galmeessuun jalqabaa.', 'ክሳብ ሕጂ ንጥፈት የለን። ዓሚል ወይ ሰራሕተኛ ብምምዝጋብ ጀምሩ።'],
  ['Lead book', 'የደንበኞች መዝገብ', 'Galmee maamiltootaa', 'መዝገብ መራሕቲ'],
  ['Every opportunity stays attributed to the agent who sourced it.', 'እያንዳንዱ ዕድል ያመጣው ወኪል ጋር ተያይዞ ይቆያል።', 'Carraan hundi bakka bu’aa isa fideetti galmaa’a.', 'ነፍሲ ወከፍ ዕድል ምስቲ ዘምጽኦ ወኪል ተተሓሒዙ ይቕመጥ።'],
  ['Add a lead', 'ደንበኛ ጨምር', 'Maamila dabali', 'መራሒ ወስኽ'],
  ['Lead type', 'የደንበኛ ዓይነት', 'Gosa maamilaa', 'ዓይነት መራሒ'],
  ['Household', 'ቤተሰብ', 'Maatii', 'ስድራቤት'],
  ['Business', 'ንግድ', 'Daldala', 'ንግዲ'],
  ['Worker', 'ሠራተኛ', 'Hojjetaa', 'ሰራሕተኛ'],
  ['Property', 'ንብረት', 'Qabeenya', 'ንብረት'],
  ['Name', 'ስም', 'Maqaa', 'ስም'],
  ['Save lead', 'ደንበኛን አስቀምጥ', 'Maamila olkaa’i', 'መራሒ ዓቅብ'],
  ['Leads you create will appear here.', 'የፈጠሯቸው ደንበኞች እዚህ ይታያሉ።', 'Maamiltoonni galmeessitan asitti mul’atu.', 'ዝፈጠርኩሞም መራሕቲ ኣብዚ ክርአዩ እዮም።'],
  ['Worker directory', 'የሠራተኞች ዝርዝር', 'Tarree hojjettootaa', 'ዝርዝር ሰራሕተኛታት'],
  ['Register potential workers. Compliance must verify required documents before matching.', 'ሊሠሩ የሚችሉ ሠራተኞችን ይመዝግቡ። ከማዛመድ በፊት የሚፈለጉ ሰነዶች በተገዢነት ቡድን መረጋገጥ አለባቸው።', 'Hojjettoota hojii danda’an galmeessaa. Walitti fiduu dura sanadoonni barbaachisan kutaa to’annoo seeraa mirkanaa’uu qabu.', 'ሊሰርሑ ዝኽእሉ ሰራሕተኛታት መዝግቡ። ቅድሚ ምዝማድ ዝድለዩ ሰነዳት ብክፍሊ ተገዢነት ክረጋገጹ ኣለዎም።'],
  ['Add a worker', 'ሠራተኛ ጨምር', 'Hojjetaa dabali', 'ሰራሕተኛ ወስኽ'],
  ['Full name', 'ሙሉ ስም', 'Maqaa guutuu', 'ምሉእ ስም'],
  ['Service sector', 'የአገልግሎት ዘርፍ', 'Kutaa tajaajilaa', 'ዘርፊ ኣገልግሎት'],
  ['Expected monthly rate (ETB)', 'የሚጠበቀው ወርሃዊ ክፍያ (ብር)', 'Gatii ji’aa eegamu (ETB)', 'ዝጽበ ወርሓዊ ዋጋ (ETB)'],
  ['Experience (years)', 'የሥራ ልምድ (ዓመታት)', 'Muuxannoo (waggoota)', 'ተመኩሮ (ዓመታት)'],
  ['Choose an area', 'አካባቢ ይምረጡ', 'Naannoo filadhaa', 'ከባቢ ምረጹ'],
  ['Skills (comma-separated)', 'ክህሎቶች (በኮማ ይለዩ)', 'Dandeettii (komaadhaan addaan baasi)', 'ክእለታት (ብኮማ ፍለዩ)'],
  ['Languages (comma-separated)', 'ቋንቋዎች (በኮማ ይለዩ)', 'Afaanota (komaadhaan addaan baasi)', 'ቋንቋታት (ብኮማ ፍለዩ)'],
  ['Register worker', 'ሠራተኛን መዝግብ', 'Hojjetaa galmeessi', 'ሰራሕተኛ መዝግብ'],
  ['Workers you register will appear here.', 'የሚመዘግቧቸው ሠራተኞች እዚህ ይታያሉ።', 'Hojjettoonni galmeessitan asitti mul’atu.', 'ዝመዝግብኩሞም ሰራሕተኛታት ኣብዚ ክርአዩ እዮም።'],
  ['Upload documents', 'ሰነዶችን ጫን', 'Sanadoota olkaa’i', 'ሰነዳት ስቐል'],
  ['Documents', 'ሰነዶች', 'Sanadoota', 'ሰነዳት'],
  ['Verify worker', 'ሠራተኛን አረጋግጥ', 'Hojjetaa mirkaneessi', 'ሰራሕተኛ ኣረጋግጽ'],
  ['Service requests & matching', 'የአገልግሎት ጥያቄዎች እና ማዛመድ', 'Gaaffii tajaajilaa fi walitti fiduu', 'ሕቶታት ኣገልግሎትን ምዝማድን'],
  ['Agents create demand; Super Admin reviews eligible, verified candidates and controls match decisions.', 'ወኪሎች ጥያቄ ያቀርባሉ፤ ሱፐር አስተዳዳሪው ብቁና የተረጋገጡ እጩዎችን ይመረምራል እና የማዛመድ ውሳኔዎችን ይቆጣጠራል።', 'Bakka bu’oonni fedhii uumu; bulchaan olaanaan kaadhimamtoota ulaagaa guutan fi mirkanaa’an gamaaggamee murtii walitti fiduu to’ata.', 'ወከልቲ ፍላጎት ይፈጥሩ፤ ሱፐር ኣስተዳዳሪ ብቑዓትን ዝተረጋገጹን ሕጹያት ይግምግምን ውሳነ ምዝማድ ይቆጻጸርን።'],
  ['Create a request', 'ጥያቄ ፍጠር', 'Gaaffii uumi', 'ሕቶ ፍጠር'],
  ['Customer lead', 'የደንበኛ መዝገብ', 'Galmee maamilaa', 'መዝገብ ዓሚል'],
  ['Choose a household or business lead', 'የቤተሰብ ወይም የንግድ ደንበኛ ይምረጡ', 'Maamila maatii yookaan daldalaa filadhaa', 'መራሒ ስድራቤት ወይ ንግዲ ምረጹ'],
  ['Skills to match', 'የሚዛመዱ ክህሎቶች', 'Dandeettii walitti fidamu', 'ዝዛመዱ ክእለታት'],
  ['Languages to match', 'የሚዛመዱ ቋንቋዎች', 'Afaanota walitti fidaman', 'ዝዛመዱ ቋንቋታት'],
  ['Minimum experience (years)', 'ዝቅተኛ የሥራ ልምድ (ዓመታት)', 'Muuxannoo xiqqaa (waggoota)', 'ዝተሓተ ተመኩሮ (ዓመታት)'],
  ['Monthly budget (ETB)', 'ወርሃዊ በጀት (ብር)', 'Baajata ji’aa (ETB)', 'ወርሓዊ ባጀት (ETB)'],
  ['Create request', 'ጥያቄ ፍጠር', 'Gaaffii uumi', 'ሕቶ ፍጠር'],
  ['No service requests yet.', 'እስካሁን የአገልግሎት ጥያቄ የለም።', 'Ammaaf gaaffiin tajaajilaa hin jiru.', 'ክሳብ ሕጂ ሕቶ ኣገልግሎት የለን።'],
  ['Find candidates', 'እጩዎችን ፈልግ', 'Kaadhimamtoota barbaadi', 'ሕጹያት ድለ'],
  ['Matches', 'ማዛመዶች', 'Walitti fiduu', 'ምዝማዳት'],
  ['Administration', 'አስተዳደር', 'Bulchiinsa', 'ምምሕዳር'],
  ['Compliance review', 'የተገዢነት ግምገማ', 'Gamaaggama to’annoo seeraa', 'ግምገማ ተገዢነት'],
  ['Provision accounts and review the operational summary.', 'መለያዎችን ይፍጠሩ እና የሥራ ማጠቃለያውን ይገምግሙ።', 'Herrega uumaa cuunfaa hojii gamaaggamaa.', 'ሕሳባት ፍጠሩን ጽማቕ ስራሕ ገምግሙን።'],
  ['Review account verification before activation.', 'ከማንቃት በፊት የመለያ ማረጋገጫን ይገምግሙ።', 'Akkaawuntii hojii irra oolchuu dura mirkaneessa isaa gamaaggamaa.', 'ቅድሚ ምንቃሕ ምርግጋጽ ሕሳብ ገምግሙ።'],
  ['Legal name', 'ሕጋዊ ሙሉ ስም', 'Maqaa seera qabeessa', 'ሕጋዊ ምሉእ ስም'],
  ['Role', 'ሚና', 'Gahee', 'ግደ'],
  ['Master agent', 'ዋና ወኪል', 'Bakka bu’aa olaanaa', 'ዋና ወኪል'],
  ['Field agent', 'የመስክ ወኪል', 'Bakka bu’aa dirree', 'ወኪል መስክ'],
  ['Compliance', 'ተገዢነት', 'To’annoo seeraa', 'ተገዢነት'],
  ['Finance', 'ፋይናንስ', 'Faayinaansii', 'ፋይናንስ'],
  ['Finance manager', 'የፋይናንስ አስተዳዳሪ', 'Bulchaa faayinaansii', 'ኣማሓዳሪ ፋይናንስ'],
  ['Customer', 'ደንበኛ', 'Maamila', 'ዓሚል'],
  ['Property owner', 'የንብረት ባለቤት', 'Abbaa qabeenyaa', 'ባዓል ንብረት'],
  ['No territory', 'ክልል የለም', 'Naannoo hin qabu', 'ከባቢ የለን'],
  ['Master agent (required for field agents)', 'ዋና ወኪል (ለመስክ ወኪሎች ያስፈልጋል)', 'Bakka bu’aa olaanaa (bakka bu’oota dirreef dirqama)', 'ዋና ወኪል (ንወከልቲ መስክ የድሊ)'],
  ['Choose master agent', 'ዋና ወኪል ይምረጡ', 'Bakka bu’aa olaanaa filadhaa', 'ዋና ወኪል ምረጹ'],
  ['Email', 'ኢሜይል', 'Imeelii', 'ኢመይል'],
  ['Create account', 'መለያ ፍጠር', 'Herrega uumi', 'ሕሳብ ፍጠር'],
  ['No accounts to display.', 'የሚታይ መለያ የለም።', 'Herregni agarsiisu hin jiru.', 'ዝርአ ሕሳብ የለን።'],
  ['Verify KYC', 'KYC አረጋግጥ', 'KYC mirkaneessi', 'KYC ኣረጋግጽ'],
  ['Reject', 'ውድቅ አድርግ', 'Didi', 'ነጽግ'],
  ['Activate', 'አንቃ', 'Hojii irra oolchi', 'ኣንቅሕ'],
  ['Deactivate', 'አቦዝን', 'Hojii dhaabi', 'ኣቦዝን'],
  ['Platform snapshot', 'የመድረኩ አጭር ማጠቃለያ', 'Cuunfaa waltajjii', 'ሓጺር ርእይቶ መድረኽ'],
  ['Set a new password', 'አዲስ የይለፍ ቃል ያዘጋጁ', 'Jecha icciitii haaraa qopheessaa', 'ሓድሽ መሕለፊ ቃል ኣዳሉ'],
  ['Your account requires a password change before continuing.', 'ከመቀጠልዎ በፊት የይለፍ ቃልዎን መቀየር ያስፈልጋል።', 'Itti fufuu dura jecha icciitii jijjiiruu qabdu.', 'ቅድሚ ምቕጻልኩም መሕለፊ ቃልኩም ክትቅይሩ ኣለኩም።'],
  ['Temporary password', 'ጊዜያዊ የይለፍ ቃል', 'Jecha icciitii yeroo', 'ግዝያዊ መሕለፊ ቃል'],
  ['New password (12+ characters)', 'አዲስ የይለፍ ቃል (12+ ቁምፊዎች)', 'Jecha icciitii haaraa (qubee 12+)', 'ሓድሽ መሕለፊ ቃል (12+ ፊደላት)'],
  ['Update password', 'የይለፍ ቃል አዘምን', 'Jechoota icciitii haaromsi', 'መሕለፊ ቃል ኣሐድስ'],
  ['Account security', 'የመለያ ደህንነት', 'Nageenya herregaa', 'ድሕነት ሕሳብ'],
  ['Protect your account with an authenticator app.', 'በማረጋገጫ መተግበሪያ መለያዎን ይጠብቁ።', 'Appii mirkaneessaatiin herrega keessan eeggadhaa.', 'ብመተግበሪ መረጋገጺ ሕሳብኩም ሓልዉ።'],
  ['Two-step verification is enabled', 'ባለሁለት ደረጃ ማረጋገጫ ነቅቷል', 'Mirkaneessi tarkaanfii lamaa hojii irra ooleera', 'ክልተ-ደረጃ ምርግጋጽ ነቒሑ ኣሎ'],
  ['Two-step verification', 'ባለሁለት ደረጃ ማረጋገጫ', 'Mirkaneessa tarkaanfii lamaa', 'ክልተ-ደረጃ ምርግጋጽ'],
  ['Your sign-in uses a password and authenticator code.', 'ለመግባት የይለፍ ቃል እና የማረጋገጫ ኮድ ይጠቀማሉ።', 'Seenuuf jecha icciitii fi koodii mirkaneessaa fayyadama.', 'ንምእታው መሕለፊ ቃልን ኮድ መረጋገጺን ይጥቀም።'],
  ['Use an authenticator app to generate a one-time sign-in code.', 'ለአንድ ጊዜ የመግቢያ ኮድ ለማመንጨት የማረጋገጫ መተግበሪያ ይጠቀሙ።', 'Koodii yeroo tokkoo seensaa uumuuf appii mirkaneessaa fayyadamaa.', 'ንሓደ ግዜ ኮድ መእተዊ ንምፍጣር መተግበሪ መረጋገጺ ተጠቐሙ።'],
  ['Set up authenticator', 'የማረጋገጫ መተግበሪያ ያዘጋጁ', 'Appii mirkaneessaa qopheessaa', 'መተግበሪ መረጋገጺ ኣዳሉ'],
  ['Add this account in your authenticator app using the setup key below.', 'ከታች ያለውን የማዋቀሪያ ቁልፍ በመጠቀም ይህን መለያ ወደ ማረጋገጫ መተግበሪያዎ ያክሉ።', 'Furtuu qophii armaan gadii fayyadamuun herrega kana appii mirkaneessaa keessanitti dabalaa.', 'ታሕቲ ዘሎ መፍትሕ ምድላው ብምጥቃም እዚ ሕሳብ ናብ መተግበሪ መረጋገጺኹም ወስኹ።'],
  ['Six-digit authenticator code', 'ስድስት አሃዝ ያለው የማረጋገጫ ኮድ', 'Koodii mirkaneessaa lakkoofsa ja’a qabu', 'ሽዱሽተ ኣሃዝ ዘለዎ ኮድ መረጋገጺ'],
  ['Verify and enable', 'አረጋግጥ እና አንቃ', 'Mirkaneessi hojii irra oolchi', 'ኣረጋግጽን ኣንቅሕን'],
  ['Eligible candidates', 'ብቁ እጩዎች', 'Kaadhimamtoota ulaagaa guutan', 'ብቑዓት ሕጹያት'],
  ['No verified available workers meet this request yet.', 'ይህን ጥያቄ የሚያሟሉ የተረጋገጡ እና ዝግጁ ሠራተኞች እስካሁን የሉም።', 'Hojjettoonni mirkanaa’anii fi argaman gaaffii kana guutan ammaaf hin jiran.', 'ነዚ ሕቶ ዘማልኡ ዝተረጋገጹን ድሉዋትን ሰራሕተኛታት ክሳብ ሕጂ የለዉን።'],
  ['Propose match', 'ማዛመድ አቅርብ', 'Walitti fiduu dhiyeessi', 'ምዝማድ ኣቕርብ'],
  ['Proposed matches', 'የቀረቡ ማዛመዶች', 'Walitti fiduun dhiyaate', 'ዝቐረቡ ምዝማዳት'],
  ['No matches have been proposed.', 'ማዛመድ እስካሁን አልቀረበም።', 'Ammaaf walitti fiduun hin dhiyaanne.', 'ምዝማድ ክሳብ ሕጂ ኣይቀረበን።'],
  ['Accept & reserve', 'ተቀበል እና ያዝ', 'Fudhadhu fi qabsiisi', 'ተቐበልን ሓዝን'],
  ['Decline', 'እምቢ በል', 'Didi', 'ነጽግ'],
  ['Release reservation', 'የተያዘውን ቦታ ፍታ', 'Qabsiisa hiiki', 'ዝተሓዝአ ምድብ ፍትሕ'],
  ['Worker documents', 'የሠራተኛ ሰነዶች', 'Sanadoota hojjetaa', 'ሰነዳት ሰራሕተኛ'],
  ['No documents uploaded yet.', 'እስካሁን ሰነድ አልተጫነም።', 'Ammaaf sanadoonni hin fe’amne.', 'ክሳብ ሕጂ ሰነድ ኣይተሰቕለን።'],
  ['Download', 'አውርድ', 'Buusi', 'ኣውርድ'],
  ['Verify document', 'ሰነድን አረጋግጥ', 'Sanada mirkaneessi', 'ሰነድ ኣረጋግጽ'],
  ['Upload identity document', 'የመታወቂያ ሰነድ ጫን', 'Sanada eenyummaa olkaa’i', 'ሰነድ መንነት ስቐል'],
  ['Document type', 'የሰነድ ዓይነት', 'Gosa sanadaa', 'ዓይነት ሰነድ'],
  ['National ID', 'ብሔራዊ መታወቂያ', 'Waraqaa eenyummaa biyyaalessaa', 'ሃገራዊ መንነት'],
  ['Police clearance', 'የፖሊስ ማረጋገጫ', 'Ragaa qulqullina poolisii', 'መረጋገጺ ፖሊስ'],
  ['Reference', 'ማጣቀሻ', 'Wabii', 'መወከሲ'],
  ['Certificate', 'ምስክር ወረቀት', 'Ragaa', 'ምስክር ወረቐት'],
  ['Expiry date (if applicable)', 'የማብቂያ ቀን (ካለ)', 'Guyyaa xumuraa (yoo jiraate)', 'ዕለት ምውዳእ (እንተሃልዩ)'],
  ['PDF, JPEG or PNG (up to 10 MB)', 'PDF፣ JPEG ወይም PNG (እስከ 10 MB)', 'PDF, JPEG yookaan PNG (hanga 10 MB)', 'PDF፣ JPEG ወይ PNG (ክሳብ 10 MB)'],
  ['Upload privately', 'በግል ጫን', 'Dhuunfaatti olkaa’i', 'ብሕቡእ ስቐል'],
  ['My leads', 'የእኔ ደንበኞች', 'Maamiltoota koo', 'መራሕተይ'],
  ['Open requests', 'ክፍት ጥያቄዎች', 'Gaaffii banaa', 'ክፉታት ሕቶታት'],
  ['Commission events', 'የኮሚሽን ክስተቶች', 'Taateewwan komishinii', 'ፍጻመታት ኮሚሽን'],
  ['active', 'ንቁ', 'Hojii irra', 'ንጡፍ'],
  ['new', 'አዲስ', 'Haaraa', 'ሓድሽ'],
  ['qualified', 'ብቁ', 'Ulaagaa guute', 'ብቑዕ'],
  ['converted', 'የተቀየረ', 'Jijjiirame', 'ዝተቐየረ'],
  ['lost', 'የጠፋ', 'Dhabame', 'ዝጠፍአ'],
  ['uploaded', 'ተጭኗል', 'Fe’ame', 'ተሰቒሉ'],
  ['under_review', 'በግምገማ ላይ', 'Gamaaggama irra jira', 'ኣብ ግምገማ ዘሎ'],
  ['verified', 'ተረጋግጧል', 'Mirkanaa’eera', 'ተረጋጊጹ'],
  ['rejected', 'ውድቅ ተደርጓል', 'Didameera', 'ተነጺጉ'],
  ['expired', 'ጊዜው አልፏል', 'Yeroon isaa darbeera', 'ግዜኡ ሓሊፉ'],
  ['superseded', 'በአዲስ ተተክቷል', 'Haaraadhaan bakka bu’eera', 'ብሓድሽ ተተኪኡ'],
  ['unavailable', 'አይገኝም', 'Hin argamu', 'ኣይርከብን'],
  ['cancelled', 'ተሰርዟል', 'Haqameera', 'ተሰሪዙ'],
  ['open', 'ክፍት', 'Banaa', 'ክፉት'],
  ['matched', 'ተዛምዷል', 'Walitti fideera', 'ተዛሚዱ'],
  ['closed', 'ተዘግቷል', 'Cufameera', 'ተዓጽዩ'],
  ['proposed', 'ቀርቧል', 'Dhiyaateera', 'ቀሪቡ'],
  ['accepted', 'ተቀባይነት አግኝቷል', 'Fudhatameera', 'ተቐባልነት ረኺቡ'],
  ['declined', 'ውድቅ ተደርጓል', 'Didameera', 'ተነጺጉ'],
  ['immediate', 'ወዲያውኑ', 'Battalumatti', 'ብቕጽበት'],
  ['within_2_weeks', 'በ2 ሳምንታት ውስጥ', 'Torban 2 keessatti', 'ኣብ 2 ሰሙን'],
  ['later', 'በኋላ', 'Booda', 'ጸኒሑ'],
  ['Enter a valid number.', 'ትክክለኛ ቁጥር ያስገቡ።', 'Lakkoofsa sirrii galchaa.', 'ቅኑዕ ቁጽሪ ኣእትዉ።'],
  ['Enter the six-digit code from your authenticator app.', 'ከማረጋገጫ መተግበሪያዎ የስድስት አሃዝ ኮድ ያስገቡ።', 'Koodii lakkoofsa ja’aa appii mirkaneessaa keessan irraa galchaa.', 'ካብ መተግበሪ መረጋገጺኹም ሽዱሽተ ኣሃዝ ዘለዎ ኮድ ኣእትዉ።'],
  ['Choose a document to upload.', 'የሚጫን ሰነድ ይምረጡ።', 'Sanada olkaa’u filadhaa.', 'ዝስቀል ሰነድ ምረጹ።'],
  ['Password updated successfully.', 'የይለፍ ቃሉ በተሳካ ሁኔታ ተዘምኗል።', 'Jechi icciitii milkaa’inaan haaromfameera.', 'መሕለፊ ቃል ብዓወት ተሓዲሱ።'],
  ['Two-step verification enabled.', 'ባለሁለት ደረጃ ማረጋገጫ ነቅቷል።', 'Mirkaneessi tarkaanfii lamaa hojii irra ooleera.', 'ክልተ-ደረጃ ምርግጋጽ ነቒሑ።'],
  ['Document uploaded for compliance review.', 'ሰነዱ ለተገዢነት ግምገማ ተጭኗል።', 'Sanadni gamaaggama to’annoo seeraatiif fe’ameera.', 'ሰነድ ንግምገማ ተገዢነት ተሰቒሉ።'],
  ['Saved successfully.', 'በተሳካ ሁኔታ ተቀምጧል።', 'Milkaa’inaan olkaa’ameera.', 'ብዓወት ተዓቂቡ።'],
  ['Worker verified and ready for matching.', 'ሠራተኛው ተረጋግጦ ለማዛመድ ዝግጁ ነው።', 'Hojjetaan mirkanaa’ee walitti fiduuf qophaa’eera.', 'ሰራሕተኛ ተረጋጊጹ ንምዝማድ ድሉው እዩ።'],
  ['Match proposed.', 'ማዛመዱ ቀርቧል።', 'Walitti fiduun dhiyaateera.', 'ምዝማድ ቀሪቡ።'],
  ['Match accepted and worker reserved.', 'ማዛመዱ ተቀባይነት አግኝቶ ሠራተኛው ተይዟል።', 'Walitti fiduun fudhatamee hojjetaan qabsiifameera.', 'ምዝማድ ተቐቢሉ ሰራሕተኛ ተሓዚኡ።'],
  ['Match declined.', 'ማዛመዱ ውድቅ ተደርጓል።', 'Walitti fiduun didameera.', 'ምዝማድ ተነጺጉ።'],
  ['Reservation released and request reopened.', 'የተያዘው ቦታ ተለቋል እና ጥያቄው እንደገና ተከፍቷል።', 'Qabsiisni hiikamee gaaffiin irra deebi’amee banameera.', 'ምድብ ተፈቲሑ ሕቶ እንደገና ተኸፊቱ።'],
  ['Worker availability after release: immediate, within_2_weeks, or later', 'ከመልቀቁ በኋላ የሠራተኛ አቅርቦት፦ ወዲያውኑ፣ በ2 ሳምንታት ውስጥ ወይም በኋላ', 'Argama hojjetaa erga hiikamee booda: battalumatti, torban 2 keessatti, yookaan booda', 'ድልውነት ሰራሕተኛ ድሕሪ ምፍታሕ፦ ብቕጽበት፣ ኣብ 2 ሰሙን፣ ወይ ጸኒሑ'],
  ['Enter the API server address first.', 'መጀመሪያ የAPI አገልጋይ አድራሻውን ያስገቡ።', 'Jalqaba teessoo sarvarii API galchaa.', 'ቅድሚ ኩሉ ኣድራሻ ሰርቨር API ኣእትዉ።'],
  ['Use a valid HTTPS server URL. HTTP is allowed only for localhost development.', 'ትክክለኛ HTTPS የአገልጋይ URL ይጠቀሙ። HTTP ለlocalhost ልማት ብቻ ይፈቀዳል።', 'URL sarvarii HTTPS sirrii fayyadamaa. HTTP localhost misoomaaf qofa hayyamama.', 'ቅኑዕ URL ሰርቨር HTTPS ተጠቐሙ። HTTP ንlocalhost ምምዕባል ጥራይ ይፍቀድ።'],
  ['Server address saved.', 'የአገልጋይ አድራሻ ተቀምጧል።', 'Teessoon sarvarii olkaa’ameera.', 'ኣድራሻ ሰርቨር ተዓቂቡ።'],
  ['Network request failed. Check your connection and server address.', 'የኔትወርክ ጥያቄ አልተሳካም። ግንኙነትዎን እና የአገልጋይ አድራሻውን ያረጋግጡ።', 'Gaaffiin neetworkii hin milkoofne. Walqunnamtii fi teessoo sarvarii keessan mirkaneessaa.', 'ሕቶ ኔትወርክ ኣይተዓወተን። ርክብኩምን ኣድራሻ ሰርቨርን ኣረጋግጹ።'],
  ['Create an account', 'መለያ ይፍጠሩ', 'Herrega uumaa', 'ሕሳብ ፍጠሩ'],
  ['Sign up', 'ይመዝገቡ', 'Galmaa’aa', 'ተመዝገቡ'],
  ['Apply to join AfroLife', 'ወደ AfroLife ለመቀላቀል ያመልክቱ', 'AfroLife waliin makamuuf iyyadhaa', 'ምስ AfroLife ንምጽንባር ኣመልክቱ'],
  ['Choose account type', 'የመለያ ዓይነት ይምረጡ', 'Gosa herregaa filadhaa', 'ዓይነት ሕሳብ ምረጹ'],
  ['I want to join as a worker', 'እንደ ሠራተኛ መቀላቀል እፈልጋለሁ', 'Hojjetaa ta’ee makamuun barbaada', 'ከም ሰራሕተኛ ክጽንበር እደሊ'],
  ['I want to join as a buyer / customer', 'እንደ ገዢ / ደንበኛ መቀላቀል እፈልጋለሁ', 'Akka bitataa / maamilaatti makamuun barbaada', 'ከም ገዛኢ / ዓሚል ክጽንበር እደሊ'],
  ['Buyer / customer', 'ገዢ / ደንበኛ', 'Bitataa / maamila', 'ገዛኢ / ዓሚል'],
  ['Available property listings', 'ያሉ የንብረት ዝርዝሮች', 'Tarree qabeenya jiran', 'ዝርዝር ንብረታት ዘለዉ'],
  ['Browse available properties and view their pictures.', 'ያሉ ንብረቶችን ይመልከቱ እና ምስሎቻቸውን ይመልከቱ።', 'Qabeenya jiran ilaalaa, suuraawwan isaanii daawwadhaa.', 'ንብረታት ዘለዉ ርኣዩን ስእልታቶም ተመልከቱን።'],
  ['I want to join as a seller / property owner', 'እንደ ሻጭ / የንብረት ባለቤት መቀላቀል እፈልጋለሁ', 'Akka gurguraa / abbaa qabeenyaatti makamuun barbaada', 'ከም ሻየጣይ / ባዓል ንብረት ክጽንበር እደሊ'],
  ['I want to join as an agent', 'እንደ ወኪል መቀላቀል እፈልጋለሁ', 'Bakka bu’aa ta’ee makamuun barbaada', 'ከም ወኪል ክጽንበር እደሊ'],
  ['Agent type', 'የወኪል ዓይነት', 'Gosa bakka bu’aa', 'ዓይነት ወኪል'],
  ['Your territory', 'የእርስዎ ክልል', 'Naannoo keessan', 'ከባቢኹም'],
  ['Master agent phone number', 'የዋና ወኪል ስልክ ቁጥር', 'Lakkoofsa bilbilaa bakka bu’aa olaanaa', 'ቁጽሪ ስልኪ ዋና ወኪል'],
  ['Agent subscription plan', 'የወኪል ምዝገባ ዕቅድ', 'Karoora maallaqa bakka bu’aa', 'መደብ ኣባልነት ወኪል'],
  ['Free plan', 'ነፃ ዕቅድ', 'Karoora bilisaa', 'ነጻ መደብ'],
  ['Pro plan', 'ፕሮ ዕቅድ', 'Karoora Pro', 'መደብ Pro'],
  ['Enterprise plan', 'የድርጅት ዕቅድ', 'Karoora dhaabbataa', 'መደብ ድርጅት'],
  ['Free', 'ነፃ', 'Bilisaa', 'ነጻ'],
  ['Pro', 'ፕሮ', 'Pro', 'Pro'],
  ['Enterprise', 'ድርጅት', 'Dhaabbata', 'ድርጅት'],
  ['Plan choice is recorded as a request only. No payment will be collected or plan activated until billing is configured.', 'የዕቅድ ምርጫዎ እንደ ጥያቄ ብቻ ይመዘገባል። የክፍያ ሥርዓት እስኪዘጋጅ ድረስ ክፍያ አይሰበሰብም ወይም ዕቅድ አይነቃም።', 'Filannoon karooraa gaaffii qofa ta’ee galmaa’a. Sirni kaffaltii hamma qophaa’utti kaffaltiin hin funaanamu, karoorri hin hojii irra oolu.', 'ምርጫ መደብኩም ከም ሕቶ ጥራይ ይምዝገብ። ስርዓት ክፍሊት ክሳብ ዝዳሎ ክፍሊት ኣይእከብን መደብ ኣይንቀሳቐስን።'],
  ['Staff approval is required before sign-in. Your account will remain inactive until compliance review and activation are complete.', 'ከመግባትዎ በፊት የሠራተኛ ፈቃድ ያስፈልጋል። የተገዢነት ግምገማና ማንቃት እስኪጠናቀቁ ድረስ መለያዎ ንቁ አይሆንም።', 'Seenuun dura hayyamni hojjettootaa barbaachisa. Gamaaggamni to’annoo seeraa fi hojii irra oolchuun hamma xumuramutti herregni keessan hin hojii irra oolu.', 'ቅድሚ ምእታው ፍቓድ ሰራሕተኛ የድሊ። ግምገማ ተገዢነትን ምንቃሕን ክሳብ ዝውዳእ ሕሳብኩም ንጡፍ ኣይከውንን።'],
  ['Submit sign-up request', 'የምዝገባ ጥያቄ አስገባ', 'Gaaffii galmee ergaa', 'ሕቶ ምዝገባ ኣቕርብ'],
  ['Already have an account? Sign in', 'መለያ አለዎት? ይግቡ', 'Herrega qabduu? Seenaa', 'ሕሳብ ኣለኩም? እቶ'],
  ['Request received. Staff will review your registration. You can sign in after your account is verified and activated.', 'ጥያቄዎ ደርሷል። ሠራተኞች ምዝገባዎን ይገመግማሉ። መለያዎ ከተረጋገጠና ከነቃ በኋላ መግባት ይችላሉ።', 'Gaaffiin keessan nu gaheera. Hojjettoonni galmee keessan ni gamaaggamu. Herregni keessan erga mirkanaa’ee fi hojii irra oolee booda seenuu dandeessu.', 'ሕቶኹም በጺሑ። ሰራሕተኛታት ምዝገባኹም ክግምግሙ እዮም። ሕሳብኩም ምስ ተረጋገጸን ንጡፍ ምስ ኮነን ክትኣትዉ ትኽእሉ።'],
  ['This field agent is not linked to an active master agent in the selected territory.', 'ይህ የመስክ ወኪል በተመረጠው ክልል ካለ ንቁ ዋና ወኪል ጋር አልተገናኘም።', 'Bakka bu’aan dirree kun naannoo filatame keessatti bakka bu’aa olaanaa hojii irra jiru waliin hin walqabatu.', 'እዚ ወኪል መስክ ኣብቲ ዝተመርጸ ከባቢ ምስ ንጡፍ ዋና ወኪል ኣይተተሓሓዘን።'],
  ['Check the parent agent phone and territory.', 'የዋና ወኪሉን ስልክ ቁጥር እና ክልል ያረጋግጡ።', 'Lakkoofsa bilbilaa fi naannoo bakka bu’aa olaanaa mirkaneessaa.', 'ቁጽሪ ስልኪ ዋና ወኪልን ከባቢን ኣረጋግጹ።'],
  ['Payment not configured', 'ክፍያ አልተዋቀረም', 'Kaffaltiin hin qophoofne', 'ክፍሊት ኣይተዳለወን'],
  ['Plan requested', 'የተጠየቀ ዕቅድ', 'Karoora gaafatame', 'ዝተሓተተ መደብ'],
  ['Sign-up request', 'የምዝገባ ጥያቄ', 'Gaaffii galmee', 'ሕቶ ምዝገባ'],
  ['Application pending approval', 'ማመልከቻው ፈቃድ እየጠበቀ ነው', 'Iyyannoon hayyama eeggataa jira', 'ምልክታ ፍቓድ ይጽበ ኣሎ'],
  ['Registration submitted. No payment was taken and no subscription is active.', 'ምዝገባ ቀርቧል። ምንም ክፍያ አልተወሰደም እና ምዝገባ አልነቃም።', 'Galmeen dhiyaateera. Kaffaltiin hin fudhatamne, maallaqni ji’aa hojii irra hin oolle.', 'ምዝገባ ቀሪቡ። ክፍሊት ኣይተወሰደን፣ ኣባልነት ንጡፍ ኣይኮነን።'],
  ['My account', 'የእኔ መለያ', 'Herrega koo', 'ሕሳበይ'],
  ['Account type', 'የመለያ ዓይነት', 'Gosa herregaa', 'ዓይነት ሕሳብ'],
  ['Select a plan', 'ዕቅድ ይምረጡ', 'Karoora filadhaa', 'መደብ ምረጹ'],
  ['Select an account type', 'የመለያ ዓይነት ይምረጡ', 'Gosa herregaa filadhaa', 'ዓይነት ሕሳብ ምረጹ'],
  ['Select an agent type', 'የወኪል ዓይነት ይምረጡ', 'Gosa bakka bu’aa filadhaa', 'ዓይነት ወኪል ምረጹ'],
  ['Select your territory', 'ክልልዎን ይምረጡ', 'Naannoo keessan filadhaa', 'ከባቢኹም ምረጹ'],
  ['Your password must be at least 12 characters.', 'የይለፍ ቃልዎ ቢያንስ 12 ቁምፊዎች መሆን አለበት።', 'Jechi icciitii keessan yoo xiqqaate qubee 12 qabaachuu qaba.', 'መሕለፊ ቃልኩም ብውሑዱ 12 ፊደላት ክህልዎ ኣለዎ።'],
  ['Password confirmation does not match.', 'የይለፍ ቃል ማረጋገጫው አይዛመድም።', 'Mirkaneessi jecha icciitii wal hin simne.', 'ምርግጋጽ መሕለፊ ቃል ኣይሰማማዕን።'],
  ['Password confirmation', 'የይለፍ ቃል ማረጋገጫ', 'Mirkaneessa jecha icciitii', 'ምርግጋጽ መሕለፊ ቃል'],
  ['Email (optional)', 'ኢሜይል (አማራጭ)', 'Imeelii (dirqama miti)', 'ኢመይል (ኣማራጺ)'],
  ['Phone must be a valid Ethiopian number.', 'ስልክ ቁጥሩ ትክክለኛ የኢትዮጵያ ቁጥር መሆን አለበት።', 'Lakkoofsi bilbilaa lakkoofsa Itoophiyaa sirrii ta’uu qaba.', 'ቁጽሪ ስልኪ ቅኑዕ ቁጽሪ ኢትዮጵያ ክኸውን ኣለዎ።'],
  ['This account is pending staff approval.', 'ይህ መለያ የሠራተኛ ፈቃድ እየጠበቀ ነው።', 'Herregni kun hayyama hojjettootaa eeggataa jira.', 'እዚ ሕሳብ ፍቓድ ሰራሕተኛ ይጽበ ኣሎ።'],
  ['Sign-up request received.', 'የምዝገባ ጥያቄ ደርሷል።', 'Gaaffiin galmee nu gaheera.', 'ሕቶ ምዝገባ በጺሑ።'],
  ['Language', 'ቋንቋ', 'Afaan', 'ቋንቋ'],
  ['AGENCY PLATFORM', 'የኤጀንሲ መድረክ', 'Waltajjii bakka bu’ummaa', 'መድረኽ ኤጀንሲ'],
  ['Agent subscription plans', 'የወኪል ምዝገባ ዕቅዶች', 'Karoora maallaqa bakka bu’aa', 'መደባት ኣባልነት ወኪል'],
  ['Account created for {{name}}. Temporary password (shown once): {{password}}', 'ለ{{name}} መለያ ተፈጥሯል። ጊዜያዊ የይለፍ ቃል (አንድ ጊዜ ብቻ ይታያል): {{password}}', 'Herregni {{name}} uumameera. Jechi icciitii yeroo (yeroo tokko qofa mul’ata): {{password}}', 'ሕሳብ {{name}} ተፈጢሩ። ግዝያዊ መሕለፊ ቃል (ሓደ ግዜ ጥራይ ይርአ): {{password}}'],
  ['Admin workspace', 'የአስተዳዳሪ የሥራ ቦታ', 'Iddoo hojii bulchaa', 'ቦታ ስራሕ ኣማሓዳሪ'],
  ['Super Admin', 'ሱፐር አስተዳዳሪ', 'Bulchaa olaanaa', 'ሱፐር ኣማሓዳሪ'],
  ['Open skills', 'ክፍት ክህሎቶች', 'Dandeettii banaa', 'ክፉታት ክእለታት'],
  ['not specified', 'አልተገለጸም', 'Hin ibsamne', 'ኣይተገልጸን'],
  ['{{phone}} · Lead · {{date}}', '{{phone}} · ደንበኛ · {{date}}', '{{phone}} · Maamila · {{date}}', '{{phone}} · መራሒ · {{date}}'],
  ['{{sector}} · {{years}} years experience', '{{sector}} · {{years}} ዓመት ልምድ', '{{sector}} · muuxannoo waggaa {{years}}', '{{sector}} · {{years}} ዓመት ተመኩሮ'],
  ['Rate ETB {{rate}} · Request', 'ክፍያ ETB {{rate}} · ጥያቄ', 'Gatii ETB {{rate}} · Gaaffii', 'ዋጋ ETB {{rate}} · ሕቶ'],
  ['{{phone}} · {{type}}', '{{phone}} · {{type}}', '{{phone}} · {{type}}', '{{phone}} · {{type}}'],
  ['ETB {{rate}} · {{skills}} · {{status}}', 'ETB {{rate}} · {{skills}} · {{status}}', 'ETB {{rate}} · {{skills}} · {{status}}', 'ETB {{rate}} · {{skills}} · {{status}}'],
  ['{{phone}} · {{role}} · {{plan}}', '{{phone}} · {{role}} · {{plan}}', '{{phone}} · {{role}} · {{plan}}', '{{phone}} · {{role}} · {{plan}}'],
  ['Leads {{leads}} · Workers {{workers}} · Open disputes {{disputes}}', 'ደንበኞች {{leads}} · ሠራተኞች {{workers}} · ክፍት ክርክሮች {{disputes}}', 'Maamiltoota {{leads}} · Hojjettoota {{workers}} · Walitti bu’iinsa banaa {{disputes}}', 'መራሕቲ {{leads}} · ሰራሕተኛታት {{workers}} · ክፉታት ክርክራት {{disputes}}'],
  ['Match score {{score}}%', 'የማዛመድ ውጤት {{score}}%', 'Qabxii walitti fiduu {{score}}%', 'ውጽኢት ምዝማድ {{score}}%'],
  ['Expires {{date}}', 'የሚያበቃው {{date}}', 'Guyyaan xumuraa {{date}}', 'ዝውዳእ {{date}}'],
  ['Choose an agent type, territory, and plan.', 'የወኪል ዓይነት፣ ክልል እና ዕቅድ ይምረጡ።', 'Gosa bakka bu’aa, naannoo fi karoora filadhaa.', 'ዓይነት ወኪል፣ ከባቢን መደብን ምረጹ።'],
  ['Choose a valid territory.', 'ትክክለኛ ክልል ይምረጡ።', 'Naannoo sirrii filadhaa.', 'ቅኑዕ ከባቢ ምረጹ።'],
  ['A field agent needs a master agent', 'የመስክ ወኪል ዋና ወኪል ያስፈልገዋል', 'Bakka bu’aan dirree bakka bu’aa olaanaa barbaada', 'ወኪል መስክ ዋና ወኪል የድልዮ'],
  ['Agent type, territory, parent agent, and plan are only used for agent registrations.', 'የወኪል ዓይነት፣ ክልል፣ ዋና ወኪል እና ዕቅድ ለወኪል ምዝገባ ብቻ ይጠቀማሉ።', 'Gosti bakka bu’aa, naannoo, bakka bu’aa olaanaa fi karoora galmee bakka bu’aatiif qofa fayyadu.', 'ዓይነት ወኪል፣ ከባቢ፣ ዋና ወኪልን መደብን ንምዝገባ ወኪል ጥራይ ይጥቀሙ።'],
  ['Signed in as {{role}}. Your access is limited to your assigned role and territory.', 'እንደ {{role}} ገብተዋል። መዳረሻዎ በተመደበልዎ ሚና እና ክልል የተገደበ ነው።', 'Akka {{role}} seentani. Seensaan keessan gahee fi naannoo isiniif ramadame qofatti daangeffama.', 'ከም {{role}} ኣቲኹም። መእተዊኹም ብግደን ከባቢን ዝተመደበልኩም ይድረት።'],
  ['Request failed ({{status}})', 'ጥያቄው አልተሳካም ({{status}})', 'Gaaffiin hin milkoofne ({{status}})', 'ሕቶ ኣይተዓወተን ({{status}})'],
  ['Too many requests. Please try again in {{seconds}} seconds.', 'ብዙ ጥያቄዎች ተልከዋል። እባክዎ ከ{{seconds}} ሰከንድ በኋላ እንደገና ይሞክሩ።', 'Gaaffiiwwan baay’atan. Maaloo sekondii {{seconds}} booda irra deebi’ii yaali.', 'ብዙሓት ሕቶታት ተላኢኾም። በጃኹም ድሕሪ {{seconds}} ሰከንድ እንደገና ፈትኑ።'],
  ['Too many failed attempts. Try again in 15 minutes.', 'ብዙ ያልተሳኩ ሙከራዎች ተደርገዋል። እባክዎ ከ15 ደቂቃ በኋላ ይሞክሩ።', 'Yaaliiwwan baay’een hin milkoofne. Maaloo daqiiqaa 15 booda yaali.', 'ብዙሓት ዘይተዓወቱ ፈተነታት ተገይሮም። በጃኹም ድሕሪ 15 ደቒቕ ፈትኑ።'],
  ['Worker applicants must consent to identity and eligibility document review before uploading KYC documents.', 'የሠራተኛ አመልካቾች የKYC ሰነዶችን ከመጫናቸው በፊት ለመታወቂያ እና ብቁነት ማረጋገጫ እንዲጠቀሙባቸው መስማማት አለባቸው።', 'Iyyattoonni hojjetaa sanadoota KYC olkaa’uu isaanii dura eenyummaa fi ulaagaa mirkaneessuuf akka ilaalaman eeyyamuu qabu.', 'ኣመልከትቲ ሰራሕተኛ ሰነዳት KYC ቅድሚ ምጽዓኖም ንመንነትን ብቕዓትን ምርግጋጽ ክጥቀሙሎም ፍቓዶም ክህቡ ኣለዎም።'],
  ['Consent to worker document review', 'ለሠራተኛ ሰነዶች ግምገማ ፈቃድ', 'Eeyyama sakatta’iinsa sanada hojjetaa', 'ፍቓድ ንምርመራ ሰነድ ሰራሕተኛ'],
  ['AfroLife may use my National ID and police-clearance documents to verify my identity and assess eligibility for workforce services. Authorized compliance staff will review these documents, which are stored privately.', 'AfroLife የመታወቂያ ካርዴን እና የፖሊስ ማረጋገጫ ሰነዶቼን ማንነቴን ለማረጋገጥ እና ለሥራ አገልግሎቶች ብቁነቴን ለመገምገም እንዲጠቀምባቸው እስማማለሁ። ፈቃድ ያላቸው የCompliance ሠራተኞች ይመረምሯቸዋል፤ ሰነዶቹም በግል ይቀመጣሉ።', 'AfroLife sanada eenyummaa fi ragaa poolisii koo eenyummaa koo mirkaneessuu fi tajaajila hojii keessatti ulaagaa koo madaaluuf akka fayyadamu nan eeyyama. Hojjettoonni compliance hayyamaman sanadoota kana ni sakatta’u; isaanis iccitiidhaan kuufamu.', 'AfroLife ንመንነተይ ንምርግጋጽን ንኣገልግሎት ስራሕ ብቕዓተይ ንምግምጋምን ናይ መንነት መለለዪን ናይ ፖሊስ ሰነዳትን ክጥቀመሎም እሰማማዕ። ፍቓድ ዘለዎም ሰራሕተኛታት Compliance ክምርምርዎም እዮም፤ ብሕታዊ ብዝኾነ መንገዲ ይቕመጡ።'],
  ['Commissions', 'ኮሚሽኖች', 'Koomishinii', 'ኮሚሽናት'],
  ['Review earned commissions, current holdbacks, and eligible releases.', 'የተገኙ ኮሚሽኖችን፣ የተያዙ መጠኖችን እና ለመክፈል የደረሱትን ይመልከቱ።', 'Koomishinii argaman, maallaqa qabame fi kan gadi lakkifamu sakatta’aa.', 'እተረኽቡ ኮሚሽናት፣ ዝተታሕዘ ገንዘብን ክፍሊትን ርአዩ።'],
  ['No commission events are available for your account.', 'ለመለያዎ የኮሚሽን መዝገቦች አልተገኙም።', 'Galmeen koomishinii herrega keessaniif hin jiru.', 'ንመለያኹም ዝምልከት መዝገብ ኮሚሽን የለን።'],
  ['Contract {{contract}} · Total ETB {{total}} · First payment ETB {{immediate}} · Held ETB {{held}}', 'ውል {{contract}} · ጠቅላላ ETB {{total}} · የመጀመሪያ ክፍያ ETB {{immediate}} · የተያዘ ETB {{held}}', 'Waliigaltee {{contract}} · Waliigala ETB {{total}} · Kaffaltii jalqabaa ETB {{immediate}} · Qabame ETB {{held}}', 'ውዕል {{contract}} · ጠቕላላ ETB {{total}} · ቀዳማይ ክፍሊት ETB {{immediate}} · ዝተታሕዘ ETB {{held}}'],
  ['Release date {{date}}', 'የመልቀቂያ ቀን {{date}}', 'Guyyaa gadi-lakkisuu {{date}}', 'ዕለት ምፍታሕ {{date}}'],
  ['Approve commission', 'ኮሚሽኑን አጽድቅ', 'Koomishinii raggaasisi', 'ነቲ ኮሚሽን ኣጽድቕ'],
  ['Pay first installment', 'የመጀመሪያ ክፍያውን ክፈል', 'Kaffaltii jalqabaa kaffali', 'ቀዳማይ ክፍሊት ክፈሉ'],
  ['Release eligible holdback', 'የደረሰውን የተያዘ ክፍያ ልቀቅ', 'Maallaqa qabame yeroo isaa gahe gadi lakkisi', 'እቲ ግዜኡ ዝበጽሐ ዝተታሕዘ ክፍሊት ፍትሑ'],
  ['Enter the payment reference.', 'የክፍያ ማጣቀሻ ያስገቡ።', 'Wabii kaffaltii galchi.', 'መወከሲ ክፍሊት ኣእትዉ።'],
  ['Commission approved.', 'ኮሚሽኑ ጸድቋል።', 'Koomishiniin ragga’eera.', 'ኮሚሽን ጸዲቑ።'],
  ['Commission installment paid.', 'የኮሚሽን ክፍያ ተከፍሏል።', 'Kaffaltiin koomishinii kaffalameera.', 'ክፍሊት ኮሚሽን ተኸፊሉ።'],
  ['Commission holdback released.', 'የተያዘው የኮሚሽን ክፍያ ተለቋል።', 'Maallaqni koomishinii qabame gadi lakkifameera.', 'ዝተታሕዘ ክፍሊት ኮሚሽን ተፈቲሑ።'],
  ['Current password is incorrect', 'የአሁኑ የይለፍ ቃል ትክክል አይደለም', 'Jechi icciitii ammaa sirrii miti', 'እዋናዊ መሕለፊ ቃል ቅኑዕ ኣይኮነን'],
  ['Invalid credentials or inactive account', 'የመግቢያ መረጃው ትክክል አይደለም ወይም መለያው ንቁ አይደለም', 'Ragaan seensaa sirrii miti yookaan herregni hojii irra hin jiru', 'መረዳእታ መእተዊ ቅኑዕ ኣይኮነን ወይ ሕሳብ ንጡፍ ኣይኮነን'],
  ['Too many failed attempts. Try again in 15 minutes.', 'ብዙ ያልተሳኩ ሙከራዎች። ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ።', 'Yaaliin kufaa baay’ateera. Daqiiqaa 15 booda irra deebi’aa.', 'ፈተነታት ዘይተዓወቱ ብዙሓት እዮም። ድሕሪ 15 ደቓይቕ እንደገና ፈትኑ።'],
  ['Invalid code', 'ትክክል ያልሆነ ኮድ', 'Koodii sirrii hin taane', 'ቅኑዕ ዘይኮነ ኮድ'],
  ['Duplicate record (e.g. phone already used, or commission already exists)', 'የተደጋገመ መዝገብ (ለምሳሌ ስልክ ቁጥሩ አስቀድሞ ተጠቅሟል)', 'Galmeen irra deddeebi’e (fakkeenyaaf lakkoofsi bilbilaa duraan fayyadame)', 'ዝተደጋገመ መዝገብ (ንኣብነት ቁጽሪ ስልኪ ቀደም ተጠቒሙ)'],
  ['{{sector}} · ETB {{rate}} · {{territory}}', '{{sector}} · ETB {{rate}} · {{territory}}', '{{sector}} · ETB {{rate}} · {{territory}}', '{{sector}} · ETB {{rate}} · {{territory}}'],
  ['{{years}} years · match score {{score}}%', '{{years}} ዓመት · የማዛመድ ውጤት {{score}}%', 'Muuxannoo waggaa {{years}} · qabxii walitti fiduu {{score}}%', '{{years}} ዓመት · ውጽኢት ምዝማድ {{score}}%'],
  ['Document {{decision}}.', 'ሰነዱ {{decision}}።', 'Sanadni {{decision}}.', 'ሰነድ {{decision}}።'],
  ['Account marked {{decision}}.', 'መለያው {{decision}} ተብሎ ተመዝግቧል።', 'Herregni {{decision}} jedhamee mallatteeffameera.', 'ሕሳብ {{decision}} ተባሂሉ ተምልኪቱ።'],
  ['Account activated.', 'መለያው ነቅቷል።', 'Herregni hojii irra ooleera.', 'ሕሳብ ነቒሑ።'],
  ['Account deactivated.', 'መለያው ቦዝኗል።', 'Herregni hojii dhaabeera.', 'ሕሳብ ተቦዚኑ።'],
  ['Choose restored availability after release: immediate, within_2_weeks, or later', 'ከመልቀቅ በኋላ የሚመለሰውን አቅርቦት ይምረጡ፦ ወዲያውኑ፣ በ2 ሳምንታት ውስጥ ወይም በኋላ', 'Argama erga hiikamee booda filadhaa: battalumatti, torban 2 keessatti, yookaan booda', 'ድልውነት ድሕሪ ምፍታሕ ምረጹ፦ ብቕጽበት፣ ኣብ 2 ሰሙን፣ ወይ ጸኒሑ'],
  ['Choose a restored availability', 'የሚመለሰውን አቅርቦት ይምረጡ', 'Argama deebifamu filadhaa', 'ዝምለስ ድልውነት ምረጹ'],
  ['Worker availability', 'የሠራተኛ አቅርቦት', 'Argama hojjetaa', 'ድልውነት ሰራሕተኛ'],
  ['Cancel', 'ሰርዝ', 'Haqi', 'ሰርዝ'],
  ['ETHIOLIFE REGISTRATION', 'የETHIOLIFE ምዝገባ', 'GALMEE ETHIOLIFE', 'ምዝገባ ETHIOLIFE'],
  ['Internal error', 'ውስጣዊ ስህተት', 'Dogoggora keessaa', 'ጌጋ ውሽጣዊ'],
  ['Business rules', 'የንግድ ደንቦች', 'Seerota daldalaa', 'ሕግታት ንግዲ'],
  ['Changes apply to new calculations immediately. Unsigned contracts are repriced; signed contracts, recorded payments, and ledger entries are not rewritten.', 'ለውጦቹ ወዲያውኑ በአዲስ ስሌቶች ላይ ይተገበራሉ። ያልተፈረሙ ውሎች ዋጋቸው ይሰላል፤ የተፈረሙ ውሎች፣ የተመዘገቡ ክፍያዎች እና የሂሳብ መዝገቦች አይቀየሩም።', 'Jijjiiramni battalumatti shallaggii haaraa irratti hojiirra oola. Waliigalteewwan hin mallatteeffamne irra deebi’anii shallagamu; waliigalteewwan mallatteeffaman, kaffaltiin galmaa’e fi galmeen herregaa hin jijjiiramu.', 'ለውጢ ብቕጽበት ኣብ ሓደስቲ ሕሳባት ይትግበር። ዘይተፈረሙ ውዕላት ዋጋኦም እንደገና ይሕሰብ፤ ዝተፈረሙ ውዕላት፣ ዝተመዝገቡ ክፍሊታትን መዝገብ ሕሳብን ኣይቀየሩን።'],
  ['Required identity and police-clearance checks, role permissions, and separate payment approvals cannot be disabled here.', 'የግዴታ የማንነትና የፖሊስ ማረጋገጫ ፍተሻዎች፣ የሚና ፈቃዶች እና የተለያዩ የክፍያ ማጽደቆች እዚህ ሊሰናከሉ አይችሉም።', 'Mirkaneessi eenyummaa fi qulqullina poolisii, hayyamni gahee, fi mirkaneessi kaffaltii namoota adda addaa kun asitti cufamuu hin danda’an.', 'ግዴታዊ ምርመራ መንነትን ናይ ፖሊስ ምስክርነትን፣ ፍቓድ ሚናን ናይ ተፈላለዩ ሰባት ምጽዳቕ ክፍሊትን ኣብዚ ክስናኸሉ ኣይክእሉን።'],
  ['Contract pricing', 'የውል ዋጋ አወጣጥ', 'Gatii waliigaltee', 'ዋጋ ውዕሊ'],
  ['Agent plans', 'የወኪል ዕቅዶች', 'Karoora bakka bu’aa', 'መደባት ወኪል'],
  ['Worker matching', 'የሠራተኛ ማዛመድ', 'Walitti fiduu hojjettootaa', 'ምዝማድ ሰራሕተኛታት'],
  ['Worker eligibility', 'የሠራተኛ ብቁነት', 'Ulaagaalee hojjetaa', 'ብቕዓት ሰራሕተኛ'],
  ['Reconciled worker payments · ETB', 'በሂሳብ የተረጋገጡ የሠራተኛ ክፍያዎች · ETB', 'Kaffaltii hojjetaa kan herregaan mirkanaa’e · ETB', 'ብሕሳብ ዝተረጋገጸ ክፍሊት ሰራሕተኛ · ETB'],
  ['Worker payment records', 'የሠራተኛ ክፍያ መዝገቦች', 'Galmee kaffaltii hojjetaa', 'መዝገባት ክፍሊት ሰራሕተኛ'],
  ['Finance reconciliation records are shown separately from approved work reports. These records are not payslips or payroll exports.', 'የፋይናንስ የማስታረቅ መዝገቦች ከተፈቀዱ የሥራ ሪፖርቶች ተለይተው ይታያሉ። እነዚህ መዝገቦች የደመወዝ ወረቀት ወይም የደመወዝ ወደ ውጭ ማስተላለፊያ አይደሉም።', 'Galmeen herregaa kaffaltii mirkaneessu gabaasa hojii ragga’e irraa adda ba’ee mul’ata. Galmeewwan kun waraqaa mindaa yookaan ergaa mindaa miti.', 'መዝገብ ምርግጋጽ ሕሳብ ካብ ዝጸደቐ ጸብጻብ ስራሕ ብተፈላለየ ይርአ። እዞም መዝገባት ወረቐት ደሞዝ ወይ ምልኣኽ ደሞዝ ኣይኮኑን።'],
  ['No worker payment records are available yet.', 'እስካሁን የሠራተኛ ክፍያ መዝገቦች የሉም።', 'Ammaaf galmeen kaffaltii hojjetaa hin jiru.', 'ክሳብ ሕጂ መዝገብ ክፍሊት ሰራሕተኛ የለን።'],
  ['ETB {{amount}} · {{date}}', 'ETB {{amount}} · {{date}}', 'ETB {{amount}} · {{date}}', 'ETB {{amount}} · {{date}}'],
  ['{{channel}} · reference {{reference}}', '{{channel}} · ማጣቀሻ {{reference}}', '{{channel}} · wabii {{reference}}', '{{channel}} · መወከሲ {{reference}}'],
  ['Review note: {{reason}}', 'የግምገማ ማስታወሻ፦ {{reason}}', 'Yaadannoo sakatta’iinsaa: {{reason}}', 'ማስታወሻ ግምገማ፦ {{reason}}'],
  ['Reconciled {{date}}', 'የተረጋገጠበት ቀን {{date}}', 'Guyyaa mirkanaa’e {{date}}', 'ዝተረጋገጸሉ ዕለት {{date}}'],
  ['My shifts and attendance', 'የእኔ ፈረቃዎችና የሥራ ሰዓት መዝገብ', 'Shiftoota koo fi galmee yeroo hojii', 'ሺፍታትን መዝገብ ሰዓታት ስራሕን'],
  ['All statuses', 'ሁሉም ሁኔታዎች', 'Haala hunda', 'ኩሎም ኩነታት'],
  ['Approved', 'ጸድቋል', 'Ragga’eera', 'ጸዲቑ'],
  ['Filter reports', 'ሪፖርቶችን አጣራ', 'Gabaasa calali', 'ጸብጻባት ምረጽ'],
  ['Download CSV', 'CSV አውርድ', 'CSV buusi', 'CSV ኣውርድ'],
  ['No reports match the selected filters.', 'ከተመረጡት ማጣሪያዎች ጋር የሚዛመድ ሪፖርት የለም።', 'Gabaasni calallii filatame waliin walsimu hin jiru.', 'ምስ ዝተመርጹ መጻረዪታት ዝሰማማዕ ጸብጻብ የለን።'],
  ['Worker activity report downloaded.', 'የሠራተኛ እንቅስቃሴ ሪፖርት ወርዷል።', 'Gabaasni sochii hojjetaa buufameera.', 'ጸብጻብ ንጥፈት ሰራሕተኛ ወሪዱ።'],
  ['There are no reports matching these filters to download.', 'ከእነዚህ ማጣሪያዎች ጋር የሚዛመድ ሪፖርት ለማውረድ የለም።', 'Gabaasni calallii kanaan walsimu buufachuuf hin jiru.', 'ምስዞም መጻረዪታት ዝሰማማዕ ንምውራድ ዝኾነ ጸብጻብ የለን።'],
  ['The report start date must be on or before its end date.', 'የሪፖርቱ መጀመሪያ ቀን ከመጨረሻው ቀን በፊት ወይም እኩል መሆን አለበት።', 'Guyyaan jalqabaa gabaasaa guyyaa xumuraa dura yookaan walqixa ta’uu qaba.', 'ዕለት መጀመርታ ጸብጻብ ቅድሚ ዕለት መወዳእታ ወይ ማዕረ ክኸውን ኣለዎ።'],
  ['Filters and exports include the 200 most recent reports currently loaded.', 'ማጣሪያዎችና ወደ ውጭ የሚላኩ ሪፖርቶች አሁን የተጫኑትን 200 የቅርብ ጊዜ ሪፖርቶች ያካትታሉ።', 'Calallii fi gabaasni buufamu gabaasota dhiheenya kana fe’aman 200 of keessatti qaba.', 'መጻረዪታትን ዝወርዱ ጸብጻባትን እቶም ኣብዚ ግዜ ዝተጸዓኑ 200 ናይ ቀረባ ጸብጻባት የጠቓልሉ።'],
  ['Respond to assigned shifts and record your own clock events. Offline events are saved on this device and synced in order when connectivity returns.', 'ለተመደቡ ፈረቃዎች ምላሽ ይስጡና የራስዎን የመግቢያና የመውጫ ሰዓት ይመዝግቡ። ከመስመር ውጭ የተመዘገቡ ክስተቶች በዚህ መሣሪያ ይቀመጣሉ፤ ግንኙነት ሲመለስ በቅደም ተከተል ይላካሉ።', 'Shiftoota siif ramadaman irratti deebii kenni; sa’aatii seensaa fi ba’iinsa kee galmeessi. Galmeen interneetii malee uumame meeshaa kana irratti ni kuufama; walqunnamtiin yommuu deebi’u tartiibaan ni ergame.', 'ኣብ ዝተመደቡልካ ሺፍታት መልሲ ሃብ፣ ሰዓታት ምእታውን ምውጻእን ድማ መዝግብ። ኣብ ዘይተራኸበ ኩነታት ዝተመዝገቡ ፍጻመታት ኣብዚ መሳርሒ ይቕመጡ፣ ርክብ ምስ ተመለሰ ብቅደም ተኸተል ይለኣኹ።'],
  ['No shifts are assigned to your worker account yet.', 'እስካሁን ለሠራተኛ መለያዎ ፈረቃ አልተመደበም።', 'Hanga ammaaf shiftiin herrega hojjetaa keetiif hin ramadamne.', 'ክሳብ ሕጂ ንሕሳብ ሰራሕተኛኻ ሺፍት ኣይተመደበን።'],
  ['Accept shift', 'ፈረቃውን ተቀበል', 'Shiftii fudhadhu', 'ነቲ ሺፍት ተቐበሎ'],
  ['Decline shift', 'ፈረቃውን እምቢ በል', 'Shiftii didi', 'ነቲ ሺፍት ኣብዮ'],
  ['Clock in', 'የሥራ መጀመሪያ መዝግብ', 'Yeroo hojii jalqabaa galmeessi', 'ሰዓት ምጅማር ስራሕ መዝግብ'],
  ['Clock out', 'የሥራ መጨረሻ መዝግብ', 'Yeroo hojii xumuraa galmeessi', 'ሰዓት ምውዳእ ስራሕ መዝግብ'],
  ['Leave and availability', 'ፈቃድና ተገኝነት', 'Hayyama fi argama', 'ፍቓድን ድልውነትን'],
  ['Submit for review', 'ለግምገማ አስገባ', 'Gamaaggamaaf dhiyeessi', 'ንግምገማ ኣቕርብ'],
  ['Withdraw request', 'ጥያቄውን አንሳ', 'Gaaffii haqii', 'ሕቶ ሰርዝ'],
  ['Payroll handoff status', 'የደመወዝ ማስተላለፊያ ሁኔታ', 'Haala dabarsa mindaa', 'ኩነታት ምሕደራ ደሞዝ'],
  ['These statuses show whether AfroLife generated an export or recorded an external handoff. They are not payslips and do not confirm payment.', 'እነዚህ ሁኔታዎች AfroLife የደመወዝ ፋይል መፍጠሩን ወይም ወደ ውጭ ማስተላለፉን ያሳያሉ። የደመወዝ ወረቀት አይደሉም፤ ክፍያ መፈጸሙንም አያረጋግጡም።', 'Haalli kun AfroLife faayila mindaa uumuu ykn dabarsa alaa galmeessuu agarsiisa. Waraqaa mindaa miti; kaffaltiin raawwatamuu isaa hin mirkaneessu.', 'እዚ ኩነታት እዚ AfroLife ፋይል ደሞዝ ምፍጣሩ ወይ ናብ ወጻኢ ምስግጋሩ የርኢ። ወረቐት ደሞዝ ኣይኮነን፣ ክፍሊት ምፍጻሙ እውን ኣየረጋግጽን።'],
  ['Workforce operations', 'የሠራተኛ ኃይል አስተዳደር', 'Bulchiinsa humna hojii', 'ምምሕዳር ሓይሊ ሰራሕተኛ'],
  ['Shift scheduling', 'የፈረቃ መርሐ ግብር', 'Sagantaa shiftii', 'መደብ ሺፍት'],
  ['Attendance exceptions and approvals', 'የሰዓት ልዩነቶችና ማጽደቆች', 'Adda durummaa fi mirkaneessa argama hojii', 'ፍልልያት ሰዓትን ምጽዳቕን'],
  ['Leave and availability review', 'የፈቃድና ተገኝነት ግምገማ', 'Gamaaggama hayyamaa fi argamaa', 'ግምገማ ፍቓድን ድልውነትን'],
  ['Effective-dated workforce policies', 'በተወሰነ የተፈጻሚነት ቀን የሠራተኛ ፖሊሲዎች', 'Imaammata humna hojii kan guyyaan hojii irra oolu murtaa’e', 'ፖሊሲታት ሓይሊ ሰራሕተኛ ብዝተወሰነ ዕለት ዝትግበሩ'],
  ['Payable time and payroll export', 'የሚከፈል ሰዓትና የደመወዝ ፋይል', 'Yeroo kaffalamu fi faayila mindaa', 'ዝኽፈል ግዜን ፋይል ደሞዝን'],
  ['Thresholds are warnings, not automatic legal or payroll decisions. Generated files are encrypted; recording a handoff does not mean payroll was filed or paid.', 'ገደቦች ማስጠንቀቂያዎች ናቸው፤ ራስ-ሰር የሕግ ወይም የደመወዝ ውሳኔ አይደሉም። የተፈጠሩ ፋይሎች በምስጠራ ይጠበቃሉ፤ ማስተላለፊያን መመዝገብ ደመወዝ መቅረቡን ወይም መከፈሉን አያሳይም።', 'Daangaan akeekkachiisa qofa; murtii seeraa yookaan mindaa ofumaan hin kennu. Faayilli uumame ni icciti; dabarsa galmeessuun mindaan galmaa’e yookaan kaffalame jechuu miti.', 'ደረት መጠን መጠንቀቕታ ጥራይ እዩ፤ ብሕጊ ወይ ብሕሳብ ደሞዝ ባዕሉ ውሳነ ኣይኮነን። ዝተፈጥሩ ፋይላት ብምስጢር ይሕለዉ፤ ምምዝጋብ ምስግጋር ደሞዝ ቀሪቡ ወይ ተኸፊሉ ማለት ኣይኮነን።'],
  ['Calculate payable time', 'የሚከፈል ሰዓት አስላ', 'Yeroo kaffalamu shallagi', 'ዝኽፈል ግዜ ሕሰብ'],
  ['Generate encrypted export', 'በምስጠራ የተጠበቀ ፋይል ፍጠር', 'Faayila iccitii uumii', 'ብምስጢር ዝተሓለወ ፋይል ፍጠር'],
  ['Download encrypted payload', 'በምስጠራ የተጠበቀውን ፋይል አውርድ', 'Faayila iccitii buusi', 'ፋይል ብምስጢር ዝተሓለወ ኣውርድ'],
  ['Record handoff status', 'የማስተላለፊያ ሁኔታ መዝግብ', 'Haala dabarsaa galmeessi', 'ኩነታት ምስግጋር መዝግብ'],
  ['Review export rows', 'የወጪ ፋይል ረድፎችን ይመርምሩ', 'Tarreewwan faayila alaa gamaaggamaa', 'ረድፊ ፋይል ወጻኢ ገምግሙ'],
  ['Payroll export rows', 'የደመወዝ ወጪ ፋይል ረድፎች', 'Tarreewwan faayila mindaa', 'ረድፊ ፋይል ደሞዝ'],
  ['Row {{number}} · {{worker}} · {{start}} · {{minutes}} minutes', 'ረድፍ {{number}} · {{worker}} · {{start}} · {{minutes}} ደቂቃ', 'Tarree {{number}} · {{worker}} · {{start}} · daqiiqaa {{minutes}}', 'ረድፊ {{number}} · {{worker}} · {{start}} · {{minutes}} ደቒቕ'],
  ['Already requeued', 'አስቀድሞ እንደገና ተልኳል', 'Duraan irra deebi’amee ergameera', 'ድሮ እንደገና ተላኢኹ'],
  ['Create retry for failed rows', 'ላልተሳኩ ረድፎች እንደገና መላኪያ ፍጠር', 'Tarreewwan kufaniif irra deebi’ii erguu uumi', 'ንዝፈሸሉ ረድፍታት ዳግማይ ምልኣኽ ፍጠር'],
  ['Select at least one failed row to create a retry export.', 'እንደገና የሚላክ ፋይል ለመፍጠር ቢያንስ አንድ ያልተሳካ ረድፍ ይምረጡ።', 'Faayila irra deebi’amee ergamu uumuuf yoo xiqqaate tarree kufe tokko filadhaa.', 'ዳግማይ ዝለኣኽ ፋይል ንምፍጣር እንተወሓደ ሓደ ዝፈሸለ ረድፊ ምረጹ።'],
  ['Enter why the external payroll system rejected these rows (at least 10 characters).', 'ውጫዊው የደመወዝ ሥርዓት እነዚህን ረድፎች ለምን እንደከለከለ አስገቡ (ቢያንስ 10 ቁምፊዎች)።', 'Sirni mindaa alaa tarreewwan kana maaliif akka dide galchaa (qubee yoo xiqqaate 10).', 'Sirni mindaa alaa tarreewwan kana maaliif akka dide galchaa (qubee yoo xiqqaate 10).'],
  ['Enter the external rejection reference, or leave blank.', 'የውጭ ውድቅ ማጣቀሻውን ያስገቡ ወይም ባዶ ይተዉት።', 'Lakkoofsa wabii diddaa alaa galchi, yookaan duwwaa dhiisi.', 'ናይ ወጻኢ መወከሲ ውድቅ ኣእቱ፣ ወይ ባዶ ግደፎ።'],
  ['External rejection reference must be at least 3 characters.', 'የውጭ ውድቅ ማጣቀሻው ቢያንስ 3 ቁምፊዎች መሆን አለበት።', 'Lakkoofsi wabii diddaa alaa yoo xiqqaate qubee 3 ta’uu qaba.', 'ናይ ወጻኢ መወከሲ ውድቅ እንተወሓደ 3 ቁምፊታት ክኸውን ኣለዎ።'],
  ['A retry export was created for only the selected failed rows. The export has not been filed or paid.', 'የተመረጡት ያልተሳኩ ረድፎች ብቻ የያዘ ዳግም መላኪያ ፋይል ተፈጥሯል። ፋይሉ አልቀረበም ወይም አልተከፈለም።', 'Faayilli irra deebi’amee ergamu tarreewwan kufan filataman qofaaf uumame. Faayilichi hin dhiyaanne yookaan hin kaffalamne.', 'ፋይል ዳግማይ ምልኣኽ ንዝተመርጹ ዝፈሸሉ ረድፍታት ጥራይ ተፈጢሩ። እቲ ፋይል ኣይቀረበን ወይ ኣይተኸፍለን።'],
  ['Property management', 'የንብረት አስተዳደር', 'Bulchiinsa qabeenyaa', 'ምምሕዳር ንብረት'],
  ['Contract workflow', 'የውል የሥራ ሂደት', 'Adeemsa hojii waliigaltee', 'መስርሕ ውዕሊ'],
  ['Refunds', 'ተመላሽ ክፍያዎች', 'Deebii kaffaltii', 'ምምላስ ክፍሊት'],
  ['Track A onboarding fee (%)', 'የትራክ A ምዝገባ ክፍያ (%)', 'Kaffaltii galmee Track A (%)', 'ክፍሊት ምጅማር Track A (%)'],
  ['Track A guarantee (%)', 'የትራክ A ዋስትና (%)', 'Wabii Track A (%)', 'ውሕስነት Track A (%)'],
  ['Track A monthly management fee (%)', 'የትራክ A ወርሃዊ አስተዳደር ክፍያ (%)', 'Kaffaltii bulchiinsa ji’aa Track A (%)', 'ወርሓዊ ክፍሊት ምምሕዳር Track A (%)'],
  ['Track B employer fee (%)', 'የትራክ B አሠሪ ክፍያ (%)', 'Kaffaltii hojjechiisaa Track B (%)', 'ክፍሊት ኣስራሒ Track B (%)'],
  ['Track B other fee (%)', 'የትራክ B ሌላ ክፍያ (%)', 'Kaffaltii biraa Track B (%)', 'ካልእ ክፍሊት Track B (%)'],
  ['First-contract commission (%)', 'የመጀመሪያ ውል ኮሚሽን (%)', 'Koomishini waliigaltee jalqabaa (%)', 'ኮሚሽን ቀዳማይ ውዕሊ (%)'],
  ['Include guarantee in commission calculation', 'ዋስትናን በኮሚሽን ስሌት ውስጥ ያካትቱ', 'Wabiin shallaggii koomishinii keessatti haa dabalamu', 'ውሕስነት ኣብ ሕሳብ ኮሚሽን ኣእቱ'],
  ['Pro monthly price (ETB)', 'የፕሮ ወርሃዊ ዋጋ (ETB)', 'Gatii ji’aa Pro (ETB)', 'ወርሓዊ ዋጋ Pro (ETB)'],
  ['Enterprise monthly price (ETB)', 'የኢንተርፕራይዝ ወርሃዊ ዋጋ (ETB)', 'Gatii ji’aa Enterprise (ETB)', 'ወርሓዊ ዋጋ Enterprise (ETB)'],
  ['Paid-plan renewal grace period (days)', 'ለተከፈለ ዕቅድ የእድሳት ተጨማሪ ጊዜ (ቀናት)', 'Yeroo dabalataa haaromsaa karoora kaffaltii (guyyaa)', 'ናይ ምሕዳስ ግዜ ምሕረት ዝተኸፍለ መደብ (መዓልታት)'],
  ['Skills match weight', 'የክህሎት ማዛመድ ክብደት', 'Ulfaatina walitti fiduu dandeettii', 'ክብደት ምዝማድ ክእለት'],
  ['Location match weight', 'የአካባቢ ማዛመድ ክብደት', 'Ulfaatina walitti fiduu bakka', 'ክብደት ምዝማድ ቦታ'],
  ['Availability match weight', 'የመገኘት ማዛመድ ክብደት', 'Ulfaatina walitti fiduu argama', 'ክብደት ምዝማድ ድልውነት'],
  ['Experience match weight', 'የልምድ ማዛመድ ክብደት', 'Ulfaatina walitti fiduu muuxannoo', 'ክብደት ምዝማድ ተመኩሮ'],
  ['Rate match weight', 'የክፍያ መጠን ማዛመድ ክብደት', 'Ulfaatina walitti fiduu gatii', 'ክብደት ምዝማድ ዋጋ'],
  ['Language match weight', 'የቋንቋ ማዛመድ ክብደት', 'Ulfaatina walitti fiduu afaanii', 'ክብደት ምዝማድ ቋንቋ'],
  ['Minimum candidate score (%)', 'ዝቅተኛ የእጩ ውጤት (%)', 'Qabxii xiqqaa kaadhimamaa (%)', 'ዝተሓተ ነጥቢ ሕጹይ (%)'],
  ['Sibling-area location score factor', 'ለአጎራባች አካባቢ የቦታ ውጤት መጠን', 'Qooda qabxii bakka naannoo ollaa', 'መጠን ነጥቢ ቦታ ከባቢ ጎረቤት'],
  ['Available within two weeks score', 'በሁለት ሳምንት ውስጥ የሚገኝ ውጤት', 'Qabxii argamu torban lama keessatti', 'ነጥቢ ኣብ ክልተ ሰሙን ዝርከብ'],
  ['Available later score', 'በኋላ የሚገኝ ውጤት', 'Qabxii yeroo booda argamu', 'ነጥቢ ድሒሩ ዝርከብ'],
  ['Rate tolerance above offer (%)', 'ከቀረበው በላይ የክፍያ መጠን መቻቻል (%)', 'Danda’ama gatii dhiyaate ol (%)', 'ትዕግስቲ ዋጋ ልዕሊ ዝቐረበ (%)'],
  ['Require a verified reference document', 'የተረጋገጠ የማጣቀሻ ሰነድ ይጠይቁ', 'Sanada wabii mirkanaa’e barbaadi', 'ዝተረጋገጸ ሰነድ ምስክርነት ሕተት'],
  ['Require a verified certificate', 'የተረጋገጠ ሰርተፍኬት ይጠይቁ', 'Ragaa mirkanaa’e barbaadi', 'ዝተረጋገጸ ምስክር ወረቐት ሕተት'],
  ['Default rent due day', 'ነባሪ የኪራይ መክፈያ ቀን', 'Guyyaa kaffaltii kiraa durtii', 'ነባሪ መዓልቲ ክፍሊት ኪራይ'],
  ['Maximum lease term (months)', 'ከፍተኛ የኪራይ ውል ጊዜ (ወራት)', 'Yeroo waliigaltee kiraa ol’aanaa (ji’a)', 'ዝለዓለ ግዜ ውዕሊ ኪራይ (ኣዋርሕ)'],
  ['Invoice payment period (days)', 'የደረሰኝ ክፍያ ጊዜ (ቀናት)', 'Yeroo kaffaltii nagahee (guyyaa)', 'ግዜ ክፍሊት ደረሰኝ (መዓልታት)'],
  ['Maximum fee refund (% of fees collected)', 'ከተሰበሰበው ክፍያ የሚመለስ ከፍተኛ መጠን (%)', 'Deebii kaffaltii irraa olaanaa (% kaffaltii walitti qabame)', 'ዝለዓለ ምምላስ ካብ ዝተኣከበ ክፍሊት (%)'],
  ['Maximum guarantee refund (% of guarantee held)', 'ከተያዘው ዋስትና የሚመለስ ከፍተኛ መጠን (%)', 'Deebii wabii irraa olaanaa (% wabii qabame)', 'ዝለዓለ ምምላስ ካብ ዝተሓዘ ውሕስነት (%)'],
  ['Save business rules', 'የንግድ ደንቦችን አስቀምጥ', 'Seerota daldalaa olkaa’i', 'ሕግታት ንግዲ ዓቅብ'],
  ['No business rule changes to save.', 'የሚቀመጥ የንግድ ደንብ ለውጥ የለም።', 'Jijjiiramni seera daldalaa olkaa’amu hin jiru.', 'ዝቕመጥ ለውጢ ሕጊ ንግዲ የለን።'],
  ['Business rules saved. {{count}} unsigned contracts were repriced.', 'የንግድ ደንቦች ተቀምጠዋል። {{count}} ያልተፈረሙ ውሎች ዋጋቸው እንደገና ተሰልቷል።', 'Seerotni daldalaa olkaa’aman. Waliigalteewwan mallattoo hin qabne {{count}} irra deebi’anii gatii isaanii shallagameera.', 'ሕግታት ንግዲ ተዓቂቦም። {{count}} ዘይተፈረሙ ውዕላት ዋጋኦም እንደገና ተሓሲቡ።'],
  ['Pro plan — ETB {{amount}} per month', 'ፕሮ ዕቅድ — ETB {{amount}} በወር', 'Karoora Pro — ETB {{amount}} ji’atti', 'መደብ Pro — ETB {{amount}} ኣብ ወርሒ'],
  ['Enterprise plan — ETB {{amount}} per month', 'የድርጅት ዕቅድ — ETB {{amount}} በወር', 'Karoora Enterprise — ETB {{amount}} ji’atti', 'መደብ Enterprise — ETB {{amount}} ኣብ ወርሒ'],
  ['KYC identity document (PDF, JPEG, PNG · max 10 MB)', 'የKYC መታወቂያ ሰነድ (PDF፣ JPEG፣ PNG · ከፍተኛ 10 ሜባ)', 'Sanada eenyummaa KYC (PDF, JPEG, PNG · hanga 10 MB)', 'ሰነድ መንነት KYC (PDF, JPEG, PNG · ዝለዓለ 10 MB)'],
  ['Police clearance (required for worker applicants)', 'የፖሊስ የሥነ-ምግባር ማረጋገጫ (ለሠራተኛ አመልካቾች ግዴታ)', 'Ragaa qulqullina poolisii (kaadhimamtoota hojjetaaaf dirqama)', 'ምስክር ናይ ፖሊስ (ንኣመልከትቲ ሰራሕተኛታት ግዴታ)'],
  ['Documents are stored privately and reviewed by AfroLife compliance staff.', 'ሰነዶች በግል ይቀመጣሉ እና በAfroLife የተገዢነት ሠራተኞች ይገመገማሉ።', 'Sanadoonni iccitiidhaan kuufamu, hojjettoota to’annoo AfroLife tiin ilaalamu.', 'ሰነዳት ብምስጢር ይቕመጡ፣ ብሰራሕተኛታት ተገዢነት AfroLife ይግምገሙ።'],
  ['Property listings', 'ዝርዝር ንብረት', 'Tarree qabeenyaa', 'ዝርዝር ንብረት'],
  ['Create and manage property records, units, rent details, and private listing pictures.', 'የንብረት መዝገቦችን፣ ክፍሎችን፣ የኪራይ ዝርዝሮችን እና የግል ሥዕሎችን ይፍጠሩ እና ያስተዳድሩ።', 'Galmee qabeenyaa, kutaa, odeeffannoo kiraa fi suuraa iccitiin kuufamu uumuu fi bulchuu.', 'Galmee qabeenyaa፣ kutaa፣ bal’ina kiraaን ስእሊ ንብረትን ፍጠሩን ኣመሓድሩን።'],
  ['Add a property listing', 'የንብረት ዝርዝር ጨምር', 'Qabeenya tarree irratti dabali', 'ዝርዝር ንብረት ወስኽ'],
  ['Street address', 'የጎዳና አድራሻ', 'Teessoo daandii', 'ኣድራሻ ጎደና'],
  ['Property type', 'የንብረት ዓይነት', 'Gosa qabeenyaa', 'ዓይነት ንብረት'],
  ['Apartment building', 'የአፓርታማ ሕንፃ', 'Gamoo apartimantii', 'ህንጻ ኣፓርታማ'],
  ['House', 'ቤት', 'Mana', 'ገዛ'],
  ['Commercial', 'ንግድ', 'Daldalaa', 'ንግዳዊ'],
  ['Land', 'መሬት', 'Lafa', 'መሬት'],
  ['First unit number', 'የመጀመሪያ ክፍል ቁጥር', 'Lakkoofsa kutaa jalqabaa', 'ቁጽሪ ቀዳማይ ክፍሊ'],
  ['Floor (optional)', 'ፎቅ (አማራጭ)', 'Darbii (filannoo)', 'ደርቢ (ኣማራጺ)'],
  ['Monthly rent (ETB, optional)', 'ወርሃዊ ኪራይ (ETB፣ አማራጭ)', 'Kiraa ji’aa (ETB, filannoo)', 'ወርሓዊ ኪራይ (ETB፣ ኣማራጺ)'],
  ['Listing pictures (JPEG or PNG, up to 10 MB each)', 'የዝርዝር ሥዕሎች (JPEG ወይም PNG፣ እያንዳንዱ እስከ 10 ሜባ)', 'Suuraa tarree (JPEG yookaan PNG, tokkoon tokkoon hanga 10 MB)', 'ስእሊ ዝርዝር (JPEG ወይ PNG፣ ነፍሲ ወከፍ ክሳብ 10 MB)'],
  ['On Android, use the camera or choose images from your device. Pictures are kept private and only shown to authorized users.', 'በAndroid ላይ ካሜራውን ይጠቀሙ ወይም ከመሣሪያዎ ሥዕሎችን ይምረጡ። ሥዕሎች በግል ይቀመጣሉ እና ለተፈቀዱ ተጠቃሚዎች ብቻ ይታያሉ።', 'Android irratti kaameraa fayyadamaa yookaan suuraa meeshaa keessan irraa filadhaa. Suuraan iccitiidhaan kuufama, fayyadamtoota hayyamamaniif qofa mul’ata.', 'ኣብ Android ካሜራ ተጠቐሙ ወይ ካብ መሳርሒኹም ስእሊ ምረጹ። ስእሊ ብምስጢር ይቕመጥ፣ ንዝተፈቕደሎም ተጠቀምቲ ጥራይ ይርአ።'],
  ['Save property listing', 'የንብረት ዝርዝር አስቀምጥ', 'Tarree qabeenyaa olkaa’i', 'ዝርዝር ንብረት ዓቅብ'],
  ['No property listings yet. Add a property to start the listing.', 'እስካሁን የንብረት ዝርዝር የለም። ዝርዝር ለመጀመር ንብረት ይጨምሩ።', 'Ammaaf tarreen qabeenyaa hin jiru. Jalqabuuf qabeenya dabalaa.', 'ክሳብ ሕጂ ዝርዝር ንብረት የለን። ንምጅማር ንብረት ወስኹ።'],
  ['Pictures', 'ሥዕሎች', 'Suuraawwan', 'ስእልታት'],
  ['Add pictures', 'ሥዕሎች ጨምር', 'Suuraa dabali', 'ስእሊ ወስኽ'],
  ['Property pictures', 'የንብረት ሥዕሎች', 'Suuraa qabeenyaa', 'ስእሊ ንብረት'],
  ['No pictures have been added to this listing yet.', 'እስካሁን ለዚህ ዝርዝር ሥዕሎች አልተጨመሩም።', 'Ammaaf tarree kanaaf suuraan hin dabalamin.', 'ክሳብ ሕጂ ንዚ ዝርዝር ስእሊ ኣይተወሰኸን።'],
  ['Add listing pictures', 'የዝርዝር ሥዕሎች ጨምር', 'Suuraa tarree irratti dabali', 'ስእሊ ዝርዝር ወስኽ'],
  ['Choose pictures (JPEG or PNG, up to 10 MB each)', 'ሥዕሎችን ይምረጡ (JPEG ወይም PNG፣ እያንዳንዱ እስከ 10 ሜባ)', 'Suuraa filadhaa (JPEG yookaan PNG, tokkoon tokkoon hanga 10 MB)', 'ስእሊ ምረጹ (JPEG ወይ PNG፣ ነፍሲ ወከፍ ክሳብ 10 MB)'],
  ['Caption (optional)', 'መግለጫ (አማራጭ)', 'Ibsa gabaabaa (filannoo)', 'መግለጺ (ኣማራጺ)'],
  ['Upload pictures', 'ሥዕሎችን ጫን', 'Suuraa olkaa’i', 'ስእሊ ጽዓን'],
  ['Applicant KYC documents', 'የአመልካች KYC ሰነዶች', 'Sanadoota KYC kaadhimamaa', 'ሰነዳት KYC ኣመልካቲ'],
  ['The applicant has not uploaded any KYC documents.', 'አመልካቹ ምንም የKYC ሰነድ አልጫነም።', 'Kaadhimamaan sanada KYC tokkollee hin olkaa’in.', 'እቲ ኣመልካቲ ዝኾነ ሰነድ KYC ኣይጽዓነን።'],
  ['{{size}} · uploaded {{date}}', '{{size}} · የተጫነበት {{date}}', '{{size}} · guyyaa olkaa’ame {{date}}', '{{size}} · ዝተጸዓነሉ {{date}}'],
  ['Registration and KYC documents received. Compliance staff will review them before account activation.', 'የምዝገባ እና KYC ሰነዶች ደርሰዋል። መለያው ከመንቃቱ በፊት የተገዢነት ሠራተኞች ይገመግማሉ።', 'Galmeenii fi sanadoonni KYC fudhatamaniiru. Herregni hojii irra ooluu dura hojjettoonni to’annoo ni ilaalu.', 'ምዝገባን ሰነዳት KYCን ተቐቢልና። ቅድሚ ምንቃሕ ሕሳብ ሰራሕተኛታት ተገዢነት ክግምግምዎም እዮም።'],
  ['A registration is already pending. Upload the required documents to finish it.', 'ምዝገባ በሂደት ላይ ነው። ለማጠናቀቅ የሚፈለጉትን ሰነዶች ይጫኑ።', 'Galmeen duraan adeemsarra jira. Xumuruuf sanadoota barbaachisan olkaa’aa.', 'ምዝገባ ኣብ ምክያድ ኣሎ። ንምዝዛም ዝድለዩ ሰነዳት ጽዓኑ።'],
  ['Your registration is saved, but document upload needs attention: {{error}} Select the required files and submit again to retry.', 'ምዝገባዎ ተቀምጧል፣ ግን የሰነድ ጫና ችግር አለው፦ {{error}} እንደገና ለመሞከር የሚፈለጉትን ፋይሎች ይምረጡና ያስገቡ።', 'Galmeen keessan olkaa’ameera, garuu sanada olkaa’uun rakkoo qaba: {{error}} Irra deebi’uuf faayiloota barbaachisan filadhaa fi ergaa.', 'ምዝገባኹም ተዓቂቡ ኣሎ፣ ግን ምጽዓን ሰነድ ጸገም ኣለዎ: {{error}} ንምድጋም ዝድለዩ ፋይላት ምረጹን ኣቕርቡን።'],
  ['Property listing saved successfully.', 'የንብረት ዝርዝሩ በተሳካ ሁኔታ ተቀምጧል።', 'Tarreen qabeenyaa milkaa’inaan olkaa’ameera.', 'ዝርዝር ንብረት ብዓወት ተዓቂቡ።'],
  ['Property pictures uploaded successfully.', 'የንብረት ሥዕሎች በተሳካ ሁኔታ ተጭነዋል።', 'Suuraawwan qabeenyaa milkaa’inaan olkaa’aman.', 'ስእልታት ንብረት ብዓወት ተጸዒኖም።'],
  ['Property listing was saved, but picture upload failed: {{error}} Use Add pictures to retry.', 'የንብረት ዝርዝሩ ተቀምጧል፣ ግን ሥዕል መጫን አልተሳካም፦ {{error}} እንደገና ለመሞከር ሥዕሎች ጨምርን ይጠቀሙ።', 'Tarreen qabeenyaa olkaa’ameera, garuu suuraa olkaa’uun hin milkoofne: {{error}} Irra deebi’uuf Suuraa dabali fayyadamaa.', 'ዝርዝር ንብረት ተዓቂቡ፣ ግን ስእሊ ምጽዓን ኣይተሳኽዐን: {{error}} ንምድጋም ስእሊ ወስኽ ተጠቐሙ።'],
  ['Property pictures must be JPEG or PNG images.', 'የንብረት ሥዕሎች JPEG ወይም PNG መሆን አለባቸው።', 'Suuraawwan qabeenyaa JPEG yookaan PNG ta’uu qabu.', 'ስእልታት ንብረት JPEG ወይ PNG ክኾኑ ኣለዎም።'],
  ['Each property picture must be 10 MB or smaller.', 'እያንዳንዱ የንብረት ሥዕል 10 ሜባ ወይም ከዚያ በታች መሆን አለበት።', 'Tokkoon tokkoon suuraa qabeenyaa 10 MB yookaan isaa gadi ta’uu qaba.', 'ነፍሲ ወከፍ ስእሊ ንብረት 10 MB ወይ ካብኡ ንታሕቲ ክኸውን ኣለዎ።'],
  ['Choose at least one picture to upload.', 'ለመጫን ቢያንስ አንድ ሥዕል ይምረጡ።', 'Olkaa’uuf yoo xiqqaate suuraa tokko filadhaa.', 'ንምጽዓን እንተወሓደ ሓደ ስእሊ ምረጹ።'],
  ['Could not load a property picture ({{status}}).', 'የንብረት ሥዕል መጫን አልተቻለም ({{status}})።', 'Suuraa qabeenyaa fe’uun hin danda’amne ({{status}}).', 'ስእሊ ንብረት ምጽዓን ኣይተኻእለን ({{status}})።'],
  ['KYC documents', 'የKYC ሰነዶች', 'Sanadoota KYC', 'ሰነዳት KYC'],
  ['KYC document {{decision}}.', 'የKYC ሰነድ {{decision}}።', 'Sanadni KYC {{decision}}.', 'ሰነድ KYC {{decision}}።'],
  ['verify', 'አረጋግጥ', 'mirkaneessi', 'ኣረጋግጽ'],
  ['rejected', 'ውድቅ ተደርጓል', 'fudhatama dide', 'ተነጺጉ'],
  ['Select each required KYC document before submitting.', 'ከማስገባትዎ በፊት እያንዳንዱን የሚፈለግ KYC ሰነድ ይምረጡ።', 'Dura erguu sanada KYC barbaachisu hunda filadhaa.', 'ቅድሚ ምቕራብ ነፍሲ ወከፍ ዝድለ ሰነድ KYC ምረጹ።'],
  ['Registration succeeded but a secure document-upload token was not issued. Contact AfroLife support.', 'ምዝገባው ተሳክቷል ግን ደህንነቱ የተጠበቀ የሰነድ መጫኛ ቶከን አልተሰጠም። የAfroLife ድጋፍን ያነጋግሩ።', 'Galmeen milkaa’eera garuu mallattoon nageenya olkaa’insa sanadaa hin kennamne. Deeggarsa AfroLife qunnamaa.', 'ምዝገባ ተሳኺዑ ግን ውሑስ ምልክት ምጽዓን ሰነድ ኣይተዋህበን። ደገፍ AfroLife ርኸቡ።'],
  ['Document upload failed ({{status}})', 'ሰነድ መጫን አልተሳካም ({{status}})', 'Sanada olkaa’uun hin milkoofne ({{status}})', 'ሰነድ ምጽዓን ኣይተሳኽዐን ({{status}})'],
  ['Picture upload failed ({{status}})', 'ሥዕል መጫን አልተሳካም ({{status}})', 'Suuraa olkaa’uun hin milkoofne ({{status}})', 'ስእሊ ምጽዓን ኣይተሳኽዐን ({{status}})'],
  ['Download failed ({{status}})', 'ማውረድ አልተሳካም ({{status}})', 'Buusuun hin milkoofne ({{status}})', 'ምውራድ ኣይተሳኽዐን ({{status}})'],
];

const localeNames = { en: 'English', am: String.fromCodePoint(0x12a0,0x121b,0x122d,0x129b), om: 'Afaan Oromoo', ti: String.fromCodePoint(0x1275,0x130d,0x122d,0x129b), so: 'Soomaali', ar: String.fromCodePoint(0x627,0x644,0x639,0x631,0x628,0x64a,0x629), sw: 'Kiswahili' };
const catalogs = Object.fromEntries(Object.keys(localeNames).map((locale, column) => [
  locale,
  Object.fromEntries(rows.map((row) => [row[0], row[column]])),
]));
const addedLanguages = {
  am: {
    'Region': 'ክልል', 'City': 'ከተማ', 'Sub-city': 'ክፍለ ከተማ', 'Woreda': 'ወረዳ', 'Kebele': 'ቀበሌ', 'Territory': 'አካባቢ', 'Pro plan — ETB {{amount}} per month': 'ፕሮ ዕቅድ — ETB {{amount}} በወር', 'Enterprise plan — ETB {{amount}} per month': 'ኢንተርፕራይዝ ዕቅድ — ETB {{amount}} በወር', 'Install app': 'መተግበሪያውን ይጫኑ', 'Start typing an area name': 'የአካባቢውን ስም መጻፍ ይጀምሩ',
    'Type a city, sub-city, woreda, or kebele, then choose a matching suggestion.': 'የከተማ፣ ክፍለ ከተማ፣ ወረዳ ወይም ቀበሌ ስም ይጻፉና ተስማሚውን አማራጭ ይምረጡ።',
    'Choose a territory from the suggestions.': 'ከቀረቡት አማራጮች አካባቢ ይምረጡ።',
    'Free service': 'ነፃ አገልግሎት', 'Pro service': 'ፕሮ አገልግሎት', 'Enterprise service': 'ኢንተርፕራይዝ አገልግሎት',
    'Core agent and seller tools for leads, workers, service requests and contracts. Property listings are not included.': 'ለወኪሎችና ሻጮች ደንበኞችን፣ ሠራተኞችን፣ የአገልግሎት ጥያቄዎችንና ውሎችን የሚያስተዳድር መሠረታዊ አገልግሎት ነው። የንብረት ዝርዝር ማቅረብ አያካትትም።',
    'Everything in Free, plus property listings, units, rent details and secure property photos.': 'የነፃ አገልግሎቱን ሁሉ ከንብረት ዝርዝር፣ ክፍሎች፣ የኪራይ ዝርዝሮችና ደህንነቱ በተጠበቀ የንብረት ፎቶ ጋር ያካትታል።',
    'Everything in Pro, plus team-wide portfolio and performance insights.': 'የፕሮ አገልግሎቱን ሁሉ ከቡድን ንብረት አስተዳደርና የአፈጻጸም ሪፖርት ጋር ያካትታል።',
    'Enterprise Option A staff service': 'የኢንተርፕራይዝ ኦፕሽን A የሠራተኛ አገልግሎት',
    'For workers seeking an Option A placement with the Enterprise service pathway. Enrollment, employer terms, pension matching and Edir benefits require confirmation before activation.': 'የኦፕሽን A የኢንተርፕራይዝ የሥራ ምደባ ለሚፈልጉ ሠራተኞች ነው። ከመንቃቱ በፊት ምዝገባ፣ የአሠሪ ውል፣ የጡረታ ተዛማጅ መዋጮና የእድር ጥቅሞች መረጋገጥ አለባቸው።',
    'Team leads': 'የቡድን ደንበኞች', 'Team workers': 'የቡድን ሠራተኞች', 'Active contracts': 'ንቁ ውሎች', 'Property listings': 'የንብረት ዝርዝሮች',
    'Enterprise team and portfolio insights': 'የኢንተርፕራይዝ ቡድንና የንብረት ሪፖርት'
  },
  om: {
    'Region': 'Naannoo', 'City': 'Magaalaa', 'Sub-city': 'Kutaa magaalaa', 'Woreda': 'Aanaa', 'Kebele': 'Ganda', 'Territory': 'Naannoo', 'Pro plan — ETB {{amount}} per month': 'Karoora Pro — ETB {{amount}} jiʼatti', 'Enterprise plan — ETB {{amount}} per month': 'Karoora Enterprise — ETB {{amount}} jiʼatti', 'Install app': 'Appicha feʼi', 'Start typing an area name': 'Maqaa naannoo barreessuu jalqabaa',
    'Type a city, sub-city, woreda, or kebele, then choose a matching suggestion.': 'Maqaa magaalaa, kutaa magaalaa, aanaa yookaan ganda barreessaa, achiis yaada walsimu filadhaa.',
    'Choose a territory from the suggestions.': 'Yaadota keessaa naannoo filadhaa.',
    'Free service': 'Tajaajila bilisaa', 'Pro service': 'Tajaajila Pro', 'Enterprise service': 'Tajaajila Enterprise',
    'Core agent and seller tools for leads, workers, service requests and contracts. Property listings are not included.': 'Meeshaalee buʼuuraa bakka buʼaa fi gurgurtaaf: maamiltoota, hojjettoota, gaaffii tajaajilaa fi waliigaltee bulchuu. Tarreen qabeenyaa hin dabalamu.',
    'Everything in Free, plus property listings, units, rent details and secure property photos.': 'Tajaajila Bilisaa hunda, dabalataan tarree qabeenyaa, kutaa, odeeffannoo kiraa fi suuraa qabeenyaa eegamaa qaba.',
    'Everything in Pro, plus team-wide portfolio and performance insights.': 'Tajaajila Pro hunda, dabalataan gabaasa qabeenyaa fi raawwii garee guutuu qaba.',
    'Enterprise Option A staff service': 'Tajaajila hojjetaa Enterprise Option A',
    'For workers seeking an Option A placement with the Enterprise service pathway. Enrollment, employer terms, pension matching and Edir benefits require confirmation before activation.': 'Hojjettoota karaa tajaajila Enterprise keessatti hojii Option A barbaadaniif. Hojiitti galchuu dura galmeen, waliigalteen hojjechiisaa, qoodni penshinii fi faayidaan Edir mirkanaaʼuu qabu.',
    'Team leads': 'Maamiltoota garee', 'Team workers': 'Hojjettoota garee', 'Active contracts': 'Waliigalteewwan hojii irra jiran', 'Property listings': 'Tarreewwan qabeenyaa',
    'Enterprise team and portfolio insights': 'Gabaasa garee fi qabeenyaa Enterprise'
  },
  ti: {
    'Region': 'ክልል', 'City': 'ከተማ', 'Sub-city': 'ንኡስ ከተማ', 'Woreda': 'ወረዳ', 'Kebele': 'ቀበሌ', 'Territory': 'ከባቢ', 'Pro plan — ETB {{amount}} per month': 'ፕሮ ውጥን — ETB {{amount}} ኣብ ወርሒ', 'Enterprise plan — ETB {{amount}} per month': 'ኢንተርፕራይዝ ውጥን — ETB {{amount}} ኣብ ወርሒ', 'Install app': 'ኣፕ ጽዓን', 'Start typing an area name': 'ስም ከባቢ ምጽሓፍ ጀምሩ',
    'Type a city, sub-city, woreda, or kebele, then choose a matching suggestion.': 'ስም ከተማ፣ ንኡስ ከተማ፣ ወረዳ ወይ ቀበሌ ጽሓፉ፣ ድሕሪኡ ዝሰማማዕ ምርጫ ምረጹ።',
    'Choose a territory from the suggestions.': 'ካብቶም ምርጫታት ከባቢ ምረጹ።',
    'Free service': 'ነጻ ኣገልግሎት', 'Pro service': 'ፕሮ ኣገልግሎት', 'Enterprise service': 'ኢንተርፕራይዝ ኣገልግሎት',
    'Core agent and seller tools for leads, workers, service requests and contracts. Property listings are not included.': 'ንወከልቲን ሸየጥቲን መሰረታዊ መሳርሒታት፤ ዓማዊል፣ ሰራሕተኛታት፣ ሕቶታት ኣገልግሎትን ውዕላትን ምምሕዳር። ዝርዝር ንብረት ኣይካተትን።',
    'Everything in Free, plus property listings, units, rent details and secure property photos.': 'ኩሉ ናይ ነጻ ኣገልግሎት ብተወሳኺ ዝርዝር ንብረት፣ ኣሃዱታት፣ ዝርዝር ክራይን ውሑስ ስእሊ ንብረትን የጠቓልል።',
    'Everything in Pro, plus team-wide portfolio and performance insights.': 'ኩሉ ናይ ፕሮ ኣገልግሎት ብተወሳኺ ሰፊሕ ዝርዝር ንብረትን ሪፖርት ውጽኢት ጉጅለን የጠቓልል።',
    'Enterprise Option A staff service': 'ኢንተርፕራይዝ ኣገልግሎት ሰራሕተኛ ኣማራጺ A',
    'For workers seeking an Option A placement with the Enterprise service pathway. Enrollment, employer terms, pension matching and Edir benefits require confirmation before activation.': 'ኣብ ኢንተርፕራይዝ መንገዲ ኣማራጺ A ስራሕ ንዝደልዩ ሰራሕተኛታት። ቅድሚ ምጅማር ምዝገባ፣ ውዕል ኣስራሒ፣ መወሰኽታ ጡረታን ጥቕሚ እድርን ክረጋገጽ ኣለዎ።',
    'Team leads': 'ዓማዊል ጉጅለ', 'Team workers': 'ሰራሕተኛታት ጉጅለ', 'Active contracts': 'ንጡፋት ውዕላት', 'Property listings': 'ዝርዝር ንብረት',
    'Enterprise team and portfolio insights': 'ሪፖርት ጉጅለን ንብረትን ኢንተርፕራይዝ'
  },
  so: {
    'Region': 'Gobol', 'City': 'Magaalo', 'Sub-city': 'Xaafad', 'Woreda': 'Woreda', 'Kebele': 'Kebele', 'Territory': 'Deegaan', 'Pro plan — ETB {{amount}} per month': 'Qorshaha Pro — ETB {{amount}} bishii', 'Enterprise plan — ETB {{amount}} per month': 'Qorshaha Enterprise — ETB {{amount}} bishii', 'Sign out': 'Ka bax', 'AfroLife home': 'Bogga hore ee AfroLife', 'Language': 'Luqad', 'Install app': 'Ku rakib abka',
    'One trusted place to get work moving.': 'Hal meel oo la isku halayn karo oo shaqada lagu bilaabo.',
    'Coordinate leads, verified workers and service requests with clear ownership at every step.': 'Isku dubbarid macaamiisha, shaqaalaha la xaqiijiyey iyo codsiyada adeegga adigoo caddeynaya cidda masuulka ka ah tallaabo kasta.',
    'Verified workforce': 'Shaqaale la xaqiijiyey', 'Accountable agent network': 'Shabakad wakiillo lala xisaabtami karo', 'Central matching oversight': 'Kormeer dhexe oo isku-aadinta ah',
    'WORKER & COMMUNITY BENEFITS': 'FAA IIDOOYINKA SHAQAALAHA IYO BULSHADA', 'Build security together': 'Wadajir u dhisa ammaan dhaqaale',
    'Proposed 5% AfroLife match on eligible worker pension deposits.': 'AfroLife waxay soo jeedinaysaa inay ku darto 5% kaydka hawlgabka ee shaqaalaha u qalma.',
    'AfroLife Edir': 'Edir-ka AfroLife', 'Optional life cover': 'Caymis nololeed oo ikhtiyaari ah', 'Home protection': 'Ilaalinta guriga',
    'Open to Guaranteed Category A employees and AfroLife users, subject to program rules. Proposed ETB 2,000 joining fee + ETB 200 monthly for group accident and health cover.': 'Shaqaalaha Guaranteed Category A iyo isticmaalayaasha AfroLife way codsan karaan, sida waafaqsan xeerarka barnaamijka. Khidmadaha la soo jeediyey: ETB 2,000 gelitaanka iyo ETB 200 bishii oo loogu talagalay caymiska shilalka iyo caafimaadka kooxeed.',
    'ETB 5,000 annual contribution for proposed ETB 1 million cover for the member or spouse.': 'Lacag-bixin sanadle ah oo ETB 5,000 ah ayaa loogu talagalay caymiska la soo jeediyey ee ETB 1 milyan, xubinta ama lammaanaha.',
    'Tenants and property owners may request household fire, accidental damage and burglary cover for an additional ETB 200 premium.': 'Kiraystayaasha iyo mulkiilayaasha guryuhu waxay codsan karaan caymiska dabka, waxyeellada shilka iyo tuugada, qiime dheeraad ah oo ETB 200 ah halkii guri.',
    'Choose your interests during sign-up. No payment is taken and no match or insurance cover is active until AfroLife confirms eligibility, funding, insurer terms and a start date.': 'Dooro faa’iidooyinka aad xiisaynayso markaad isdiiwaangelinayso. Lacag lagama qaadayo, mana jiro gunno ama caymis shaqaynaya ilaa AfroLife xaqiijiso u-qalmitaanka, maalgelinta, shuruudaha caymis-bixiyaha iyo taariikhda bilowga.',
    'Apply to join AfroLife': 'Codso inaad ku biirto AfroLife', 'Welcome back': 'Soo dhawoow', 'Sign in': 'Gal', 'Sign up': 'Isdiiwaangeli',
    'Phone number': 'Lambarka telefoonka', 'Password': 'Furaha sirta ah', 'Full name': 'Magaca oo buuxa', 'Email (optional)': 'Iimayl (ikhtiyaari)',
    'Choose account type': 'Dooro nooca akoonka', 'I want to join as a worker': 'Waxaan doonayaa inaan ku biiro shaqaale ahaan',
    'I want to join as a buyer / customer': 'Waxaan doonayaa inaan ku biiro iibsade/macmiil ahaan',
    'I want to join as a seller / property owner': 'Waxaan doonayaa inaan ku biiro iibiye/mulkiile ahaan', 'I want to join as an agent': 'Waxaan doonayaa inaan ku biiro wakiil ahaan',
    'Your territory': 'Deegaankaaga', 'Start typing an area name': 'Bilow qorista magaca deegaanka',
    'Type a city, sub-city, woreda, or kebele, then choose a matching suggestion.': 'Qor magaalo, xaafad, woreda ama kebele, kadibna dooro soo-jeedin ku habboon.',
    'Choose a territory from the suggestions.': 'Ka dooro deegaanka liiska soo-jeedimaha.',
    'Benefit interests (no charge today)': 'Faa’iidooyinka aad xiisaynayso (maanta lacag lagama qaadayo)',
    'Worker pension match': 'Ku-darka kaydka hawlgabka shaqaalaha', 'Join AfroLife Edir': 'Ku biir Edir-ka AfroLife',
    'Add life cover': 'Ku dar caymis nololeed', 'Add household cover': 'Ku dar caymiska guriga',
    'These are non-binding requests for information. Selecting a benefit does not enroll you, collect money or start insurance coverage.': 'Kuwani waa codsiyo aan kugu waajibinayn oo xog-ogaalnimo ah. Doorashada faa’iido ma aha isdiiwaangelin, lacag-qaadis ama bilow caymis.',
    'Proposed ETB 2,000 joining fee and ETB 200 monthly for member group accident and health cover.': 'Khidmadaha la soo jeediyey waa ETB 2,000 gelitaanka iyo ETB 200 bishii oo loogu talagalay caymiska shilalka iyo caafimaadka kooxeed.',
    'Request the proposed 5% match on eligible pension deposits from income. Eligibility and payroll funding must be confirmed.': 'Codso ku-darka la soo jeediyey ee 5% ee kaydka hawlgabka ee dakhliga laga bixiyo. Waa in la xaqiijiyaa u-qalmitaanka iyo maalgelinta mushaharka.',
    'Proposed extra ETB 5,000 per year for ETB 1 million cover for the direct member or spouse; subject to insurer acceptance and policy terms.': 'Lacag dheeraad ah oo la soo jeediyey oo ETB 5,000 ah sannadkii si loo helo caymis ETB 1 milyan ah oo loogu talagalay xubinta ama lammaanaha; shirkadda caymiska iyo shuruudaha ayaa khuseeya.',
    'For tenants or property owners: proposed additional ETB 200 household premium for fire, accidental damage and burglary cover.': 'Kiraystayaasha ama mulkiilayaasha: lacag caymis guri oo dheeraad ah oo la soo jeediyey, ETB 200, dab, waxyeello shil iyo tuugo awgood.',
    'Plan choice is recorded as a request only. No payment will be collected or plan activated until billing is configured.': 'Doorashada qorshaha waxaa loo diiwaangelinayaa codsi keliya. Lacag lama qaadayo, qorshahana ma shaqaynayo ilaa lacag-bixinta la diyaariyo.',
    'Submit sign-up request': 'Gudbi codsiga isdiiwaangelinta', 'Already have an account? Sign in': 'Akoon ma leedahay? Gal',
    'Free service': 'Adeeg bilaash ah', 'Pro service': 'Adeegga Pro', 'Enterprise service': 'Adeegga Enterprise',
    'Core agent and seller tools for leads, workers, service requests and contracts. Property listings are not included.': 'Adeegyada aasaasiga ah ee wakiillada iyo iibiyeyaasha: maareynta macaamiisha, shaqaalaha, codsiyada adeegga iyo heshiisyada. Liisaska guryuhu kuma jiraan.',
    'Everything in Free, plus property listings, units, rent details and secure property photos.': 'Wax kasta oo Bilaashka ah, oo lagu daray liisaska guryaha, qaybaha, faahfaahinta kirada iyo sawirro guri oo ammaan ah.',
    'Everything in Pro, plus team-wide portfolio and performance insights.': 'Wax kasta oo Pro ah, oo lagu daray aragti guud oo ku saabsan hantida iyo waxqabadka kooxda.',
    'Enterprise Option A staff service': 'Adeegga shaqaalaha Enterprise Option A',
    'For workers seeking an Option A placement with the Enterprise service pathway. Enrollment, employer terms, pension matching and Edir benefits require confirmation before activation.': 'Shaqaalaha doonaya meelayn Option A oo leh adeegga Enterprise. Diiwaangelinta, shuruudaha loo-shaqeeyaha, kabka hawlgabka iyo faa’iidooyinka Edir waa in la xaqiijiyaa ka hor hawlgelinta.',
    'Team leads': 'Macaamiisha kooxda', 'Team workers': 'Shaqaalaha kooxda', 'Active contracts': 'Heshiisyada firfircoon', 'Property listings': 'Liisaska guryaha',
    'Enterprise team and portfolio insights': 'Aragtida kooxda iyo hantida Enterprise',
    'Free': 'Bilaash', 'Pro': 'Pro', 'Enterprise': 'Enterprise', 'Properties': 'Guryo', 'Workers': 'Shaqaale', 'Overview': 'Guudmar', 'Security': 'Amniga'
  },
  ar: {
    'Region': 'إقليم', 'City': 'مدينة', 'Sub-city': 'منطقة فرعية', 'Woreda': 'وردة', 'Kebele': 'كيبيلي', 'Territory': 'منطقة', 'Pro plan — ETB {{amount}} per month': 'خطة Pro — {{amount}} بر إثيوبي شهريًا', 'Enterprise plan — ETB {{amount}} per month': 'خطة Enterprise — {{amount}} بر إثيوبي شهريًا', 'Sign out': 'تسجيل الخروج', 'AfroLife home': 'الصفحة الرئيسية لأفرو لايف', 'Language': 'اللغة', 'Install app': 'تثبيت التطبيق',
    'One trusted place to get work moving.': 'مكان موثوق واحد لبدء العمل.',
    'Coordinate leads, verified workers and service requests with clear ownership at every step.': 'نسّق العملاء المحتملين والعمال المعتمدين وطلبات الخدمة مع وضوح المسؤولية في كل خطوة.',
    'Verified workforce': 'قوى عاملة تم التحقق منها', 'Accountable agent network': 'شبكة وكلاء خاضعة للمساءلة', 'Central matching oversight': 'إشراف مركزي على المطابقة',
    'WORKER & COMMUNITY BENEFITS': 'مزايا العمال والمجتمع', 'Build security together': 'نبني الأمان معًا',
    'Proposed 5% AfroLife match on eligible worker pension deposits.': 'مساهمة مطابقة مقترحة من أفرو لايف بنسبة 5٪ في إيداعات تقاعد العمال المؤهلين.',
    'AfroLife Edir': 'إدير أفرو لايف', 'Optional life cover': 'تأمين حياة اختياري', 'Home protection': 'حماية المنزل',
    'Open to Guaranteed Category A employees and AfroLife users, subject to program rules. Proposed ETB 2,000 joining fee + ETB 200 monthly for group accident and health cover.': 'متاح لموظفي الفئة المضمونة A ومستخدمي أفرو لايف وفقًا لقواعد البرنامج. الرسوم المقترحة: 2,000 بر إثيوبي للانضمام و200 بر شهريًا لتغطية جماعية للحوادث والصحة.',
    'ETB 5,000 annual contribution for proposed ETB 1 million cover for the member or spouse.': 'مساهمة سنوية مقترحة قدرها 5,000 بر إثيوبي لتغطية قدرها مليون بر للعضو أو الزوج أو الزوجة.',
    'Tenants and property owners may request household fire, accidental damage and burglary cover for an additional ETB 200 premium.': 'يمكن للمستأجرين ومالكي العقارات طلب تغطية للحريق والأضرار العرضية والسرقة المنزلية مقابل قسط إضافي قدره 200 بر إثيوبي لكل منزل.',
    'Choose your interests during sign-up. No payment is taken and no match or insurance cover is active until AfroLife confirms eligibility, funding, insurer terms and a start date.': 'اختر المزايا التي تهمك عند التسجيل. لن يتم تحصيل أي مبلغ ولن تبدأ المساهمة المطابقة أو التغطية التأمينية حتى تؤكد أفرو لايف الأهلية والتمويل وشروط شركة التأمين وتاريخ البدء.',
    'Apply to join AfroLife': 'قدّم طلب الانضمام إلى أفرو لايف', 'Welcome back': 'مرحبًا بعودتك', 'Sign in': 'تسجيل الدخول', 'Sign up': 'إنشاء حساب',
    'Phone number': 'رقم الهاتف', 'Password': 'كلمة المرور', 'Full name': 'الاسم الكامل', 'Email (optional)': 'البريد الإلكتروني (اختياري)',
    'Choose account type': 'اختر نوع الحساب', 'I want to join as a worker': 'أرغب في الانضمام كعامل',
    'I want to join as a buyer / customer': 'أرغب في الانضمام كمشترٍ / عميل',
    'I want to join as a seller / property owner': 'أرغب في الانضمام كبائع / مالك عقار', 'I want to join as an agent': 'أرغب في الانضمام كوكيل',
    'Your territory': 'منطقتك', 'Start typing an area name': 'ابدأ بكتابة اسم المنطقة',
    'Type a city, sub-city, woreda, or kebele, then choose a matching suggestion.': 'اكتب اسم مدينة أو منطقة فرعية أو وريدا أو كيبيلي، ثم اختر الاقتراح المطابق.',
    'Choose a territory from the suggestions.': 'اختر منطقة من الاقتراحات.',
    'Benefit interests (no charge today)': 'المزايا التي تهمك (دون رسوم اليوم)',
    'Worker pension match': 'مساهمة مطابقة لتقاعد العامل', 'Join AfroLife Edir': 'الانضمام إلى إدير أفرو لايف',
    'Add life cover': 'إضافة تأمين على الحياة', 'Add household cover': 'إضافة تغطية منزلية',
    'These are non-binding requests for information. Selecting a benefit does not enroll you, collect money or start insurance coverage.': 'هذه طلبات غير ملزمة للحصول على معلومات. اختيار ميزة لا يعني التسجيل أو تحصيل الأموال أو بدء التغطية التأمينية.',
    'Proposed ETB 2,000 joining fee and ETB 200 monthly for member group accident and health cover.': 'الرسوم المقترحة: 2,000 بر إثيوبي للانضمام و200 بر شهريًا للتغطية الجماعية للحوادث والصحة.',
    'Request the proposed 5% match on eligible pension deposits from income. Eligibility and payroll funding must be confirmed.': 'اطلب المساهمة المطابقة المقترحة بنسبة 5٪ في إيداعات التقاعد المؤهلة من الدخل. يجب تأكيد الأهلية وتمويل الرواتب.',
    'Proposed extra ETB 5,000 per year for ETB 1 million cover for the direct member or spouse; subject to insurer acceptance and policy terms.': 'مساهمة إضافية مقترحة قدرها 5,000 بر سنويًا لتغطية بقيمة مليون بر للعضو المباشر أو الزوج أو الزوجة، وذلك وفق قبول شركة التأمين وشروط الوثيقة.',
    'For tenants or property owners: proposed additional ETB 200 household premium for fire, accidental damage and burglary cover.': 'للمستأجرين أو مالكي العقارات: قسط منزلي إضافي مقترح قدره 200 بر لتغطية الحريق والأضرار العرضية والسطو.',
    'Plan choice is recorded as a request only. No payment will be collected or plan activated until billing is configured.': 'يُسجّل اختيار الخطة كطلب فقط. لن يتم تحصيل أي مبلغ أو تفعيل الخطة حتى يتم إعداد الفوترة.',
    'Submit sign-up request': 'إرسال طلب التسجيل', 'Already have an account? Sign in': 'لديك حساب بالفعل؟ سجّل الدخول',
    'Free service': 'الخدمة المجانية', 'Pro service': 'خدمة برو', 'Enterprise service': 'خدمة المؤسسات',
    'Core agent and seller tools for leads, workers, service requests and contracts. Property listings are not included.': 'أدوات الوكلاء والبائعين الأساسية لإدارة العملاء والعمال وطلبات الخدمة والعقود. لا تشمل إدراج العقارات.',
    'Everything in Free, plus property listings, units, rent details and secure property photos.': 'كل مزايا المجاني، بالإضافة إلى إدراج العقارات والوحدات وتفاصيل الإيجار وصور العقارات الآمنة.',
    'Everything in Pro, plus team-wide portfolio and performance insights.': 'كل مزايا برو، بالإضافة إلى رؤى محفظة الفريق وأدائه.',
    'Enterprise Option A staff service': 'خدمة موظفي المؤسسات، الخيار A',
    'For workers seeking an Option A placement with the Enterprise service pathway. Enrollment, employer terms, pension matching and Edir benefits require confirmation before activation.': 'للعمال الراغبين في تعيين الخيار A ضمن مسار خدمة المؤسسات. يجب تأكيد التسجيل وشروط صاحب العمل ومساهمة التقاعد ومزايا إدير قبل التفعيل.',
    'Team leads': 'عملاء الفريق', 'Team workers': 'عمال الفريق', 'Active contracts': 'العقود النشطة', 'Property listings': 'إدراجات العقارات',
    'Enterprise team and portfolio insights': 'رؤى فريق المؤسسات ومحفظته',
    'Free': 'مجاني', 'Pro': 'احترافي', 'Enterprise': 'مؤسسات', 'Properties': 'العقارات', 'Workers': 'العمال', 'Overview': 'نظرة عامة', 'Security': 'الأمان'
  },
  sw: {
    'Sign out': 'Toka', 'AfroLife home': 'Ukurasa wa mwanzo wa AfroLife', 'Language': 'Lugha', 'Install app': 'Sakinisha programu',
    'One trusted place to get work moving.': 'Mahali pa kuaminika pa kuanzisha kazi.',
    'Coordinate leads, verified workers and service requests with clear ownership at every step.': 'Ratibu wateja watarajiwa, wafanyakazi waliothibitishwa na maombi ya huduma huku wajibu ukiwa wazi katika kila hatua.',
    'Verified workforce': 'Wafanyakazi waliothibitishwa', 'Accountable agent network': 'Mtandao wa mawakala unaowajibika', 'Central matching oversight': 'Usimamizi mkuu wa ulinganishaji',
    'WORKER & COMMUNITY BENEFITS': 'FAIDA KWA WAFANYAKAZI NA JAMII', 'Build security together': 'Jenga usalama pamoja',
    'Proposed 5% AfroLife match on eligible worker pension deposits.': 'AfroLife inapendekeza kuongeza mchango wa 5% kwenye akiba ya pensheni ya wafanyakazi wanaostahili.',
    'AfroLife Edir': 'Edir ya AfroLife', 'Optional life cover': 'Bima ya maisha ya hiari', 'Home protection': 'Ulinzi wa nyumba',
    'Open to Guaranteed Category A employees and AfroLife users, subject to program rules. Proposed ETB 2,000 joining fee + ETB 200 monthly for group accident and health cover.': 'Wafanyakazi wa Guaranteed Category A na watumiaji wa AfroLife wanaweza kuomba kulingana na masharti ya mpango. Ada zinazopendekezwa: ETB 2,000 ya kujiunga na ETB 200 kila mwezi kwa bima ya pamoja ya ajali na afya.',
    'ETB 5,000 annual contribution for proposed ETB 1 million cover for the member or spouse.': 'Mchango wa mwaka wa ETB 5,000 unapendekezwa kwa bima ya ETB milioni 1 kwa mwanachama au mwenzi.',
    'Tenants and property owners may request household fire, accidental damage and burglary cover for an additional ETB 200 premium.': 'Wapangaji na wamiliki wa nyumba wanaweza kuomba bima ya moto, uharibifu wa bahati mbaya na wizi kwa ada ya ziada ya ETB 200 kwa kila nyumba.',
    'Choose your interests during sign-up. No payment is taken and no match or insurance cover is active until AfroLife confirms eligibility, funding, insurer terms and a start date.': 'Chagua unachopendelea unapojisajili. Hakuna malipo yanayochukuliwa wala mchango unaolinganishwa au bima inayoanza hadi AfroLife ithibitishe ustahiki, ufadhili, masharti ya bima na tarehe ya kuanza.',
    'Apply to join AfroLife': 'Omba kujiunga na AfroLife', 'Welcome back': 'Karibu tena', 'Sign in': 'Ingia', 'Sign up': 'Jisajili',
    'Phone number': 'Nambari ya simu', 'Password': 'Nenosiri', 'Full name': 'Jina kamili', 'Email (optional)': 'Barua pepe (si lazima)',
    'Choose account type': 'Chagua aina ya akaunti', 'I want to join as a worker': 'Ninataka kujiunga kama mfanyakazi',
    'I want to join as a buyer / customer': 'Ninataka kujiunga kama mnunuzi / mteja',
    'I want to join as a seller / property owner': 'Ninataka kujiunga kama muuzaji / mmiliki wa nyumba', 'I want to join as an agent': 'Ninataka kujiunga kama wakala',
    'Your territory': 'Eneo lako', 'Start typing an area name': 'Anza kuandika jina la eneo',
    'Type a city, sub-city, woreda, or kebele, then choose a matching suggestion.': 'Andika jina la jiji, kitongoji, woreda au kebele, kisha uchague pendekezo linalolingana.',
    'Choose a territory from the suggestions.': 'Chagua eneo kutoka kwenye mapendekezo.',
    'Benefit interests (no charge today)': 'Faida unazopendelea (hakuna malipo leo)',
    'Worker pension match': 'Mchango linganifu wa pensheni ya mfanyakazi', 'Join AfroLife Edir': 'Jiunge na Edir ya AfroLife',
    'Add life cover': 'Ongeza bima ya maisha', 'Add household cover': 'Ongeza bima ya nyumba',
    'These are non-binding requests for information. Selecting a benefit does not enroll you, collect money or start insurance coverage.': 'Haya ni maombi ya taarifa yasiyokufunga. Kuchagua faida hakukusajili, hakuchukui pesa wala kuanzisha bima.',
    'Proposed ETB 2,000 joining fee and ETB 200 monthly for member group accident and health cover.': 'Ada zinazopendekezwa ni ETB 2,000 ya kujiunga na ETB 200 kila mwezi kwa bima ya pamoja ya ajali na afya ya mwanachama.',
    'Request the proposed 5% match on eligible pension deposits from income. Eligibility and payroll funding must be confirmed.': 'Omba mchango linganifu wa 5% unaopendekezwa kwa akiba ya pensheni inayostahili kutoka kwenye mapato. Ustahiki na ufadhili wa mishahara lazima uthibitishwe.',
    'Proposed extra ETB 5,000 per year for ETB 1 million cover for the direct member or spouse; subject to insurer acceptance and policy terms.': 'ETB 5,000 ya ziada inapendekezwa kila mwaka kwa bima ya ETB milioni 1 kwa mwanachama au mwenzi; kwa idhini ya mtoa bima na masharti ya sera.',
    'For tenants or property owners: proposed additional ETB 200 household premium for fire, accidental damage and burglary cover.': 'Kwa wapangaji au wamiliki wa nyumba: ada ya ziada ya bima ya nyumba ya ETB 200 inapendekezwa kwa moto, uharibifu wa bahati mbaya na wizi.',
    'Plan choice is recorded as a request only. No payment will be collected or plan activated until billing is configured.': 'Chaguo la mpango hurekodiwa kama ombi tu. Hakuna malipo yatakayochukuliwa wala mpango kuanza hadi mfumo wa malipo utakapoandaliwa.',
    'Submit sign-up request': 'Tuma ombi la usajili', 'Already have an account? Sign in': 'Tayari una akaunti? Ingia',
    'Free service': 'Huduma ya bure', 'Pro service': 'Huduma ya Pro', 'Enterprise service': 'Huduma ya Enterprise',
    'Core agent and seller tools for leads, workers, service requests and contracts. Property listings are not included.': 'Zana za msingi za mawakala na wauzaji za kusimamia wateja, wafanyakazi, maombi ya huduma na mikataba. Orodha za nyumba hazijajumuishwa.',
    'Everything in Free, plus property listings, units, rent details and secure property photos.': 'Kila kitu cha Bure, pamoja na orodha za nyumba, vitengo, maelezo ya kodi na picha salama za mali.',
    'Everything in Pro, plus team-wide portfolio and performance insights.': 'Kila kitu cha Pro, pamoja na muhtasari wa mali na utendaji wa timu nzima.',
    'Enterprise Option A staff service': 'Huduma ya wafanyakazi ya Enterprise Chaguo A',
    'For workers seeking an Option A placement with the Enterprise service pathway. Enrollment, employer terms, pension matching and Edir benefits require confirmation before activation.': 'Kwa wafanyakazi wanaotafuta ajira ya Chaguo A kupitia huduma ya Enterprise. Usajili, masharti ya mwajiri, mchango linganifu wa pensheni na faida za Edir lazima zithibitishwe kabla ya kuwezesha.',
    'Team leads': 'Wateja wa timu', 'Team workers': 'Wafanyakazi wa timu', 'Active contracts': 'Mikataba inayotumika', 'Property listings': 'Orodha za mali',
    'Enterprise team and portfolio insights': 'Muhtasari wa timu na mali wa Enterprise',
    'Free': 'Bure', 'Pro': 'Pro', 'Enterprise': 'Biashara', 'Properties': 'Nyumba na mali', 'Workers': 'Wafanyakazi', 'Overview': 'Muhtasari', 'Security': 'Usalama'
  }
};
Object.assign(addedLanguages.so, {
  'Review export rows': 'Dib u eeg safafka faylka mushaharka',
  'Payroll export rows': 'Safafka faylka mushaharka',
  'Row {{number}} · {{worker}} · {{start}} · {{minutes}} minutes': 'Safka {{number}} · {{worker}} · {{start}} · {{minutes}} daqiiqo',
  'Already requeued': 'Hore ayaa dib loogu daray',
  'Create retry for failed rows': 'Abuur fayl dib loogu diro safafka fashilmay',
  'Select at least one failed row to create a retry export.': 'Dooro ugu yaraan hal saf oo fashilmay si aad u abuurto fayl dib loogu diro.',
  'Enter why the external payroll system rejected these rows (at least 10 characters).': 'Geli sababta nidaamka mushaharka dibaddu u diiday safafkan (ugu yaraan 10 xaraf).',
  'Enter the external rejection reference, or leave blank.': 'Geli tixraaca diidmada dibadda, ama ka tag isagoo bannaan.',
  'External rejection reference must be at least 3 characters.': 'Tixraaca diidmada dibaddu waa inuu ka koobnaadaa ugu yaraan 3 xaraf.',
  'A retry export was created for only the selected failed rows. The export has not been filed or paid.': 'Fayl dib loogu diro safafka fashilmay ee la doortay oo keliya ayaa la sameeyay. Faylka lama gudbin, lamana bixin.',
});
Object.assign(addedLanguages.ar, {
  'Review export rows': 'مراجعة صفوف ملف الرواتب',
  'Payroll export rows': 'صفوف ملف الرواتب',
  'Row {{number}} · {{worker}} · {{start}} · {{minutes}} minutes': 'الصف {{number}} · {{worker}} · {{start}} · {{minutes}} دقيقة',
  'Already requeued': 'أعيدت المحاولة بالفعل',
  'Create retry for failed rows': 'إنشاء إعادة محاولة للصفوف الفاشلة',
  'Select at least one failed row to create a retry export.': 'اختر صفًا فاشلًا واحدًا على الأقل لإنشاء ملف إعادة المحاولة.',
  'Enter why the external payroll system rejected these rows (at least 10 characters).': 'أدخل سبب رفض نظام الرواتب الخارجي لهذه الصفوف (10 أحرف على الأقل).',
  'Enter the external rejection reference, or leave blank.': 'أدخل مرجع الرفض الخارجي أو اتركه فارغًا.',
  'External rejection reference must be at least 3 characters.': 'يجب ألا يقل مرجع الرفض الخارجي عن 3 أحرف.',
  'A retry export was created for only the selected failed rows. The export has not been filed or paid.': 'تم إنشاء ملف إعادة محاولة للصفوف الفاشلة المحددة فقط. لم يتم تقديم الملف أو دفع الرواتب.',
});
Object.assign(addedLanguages.sw, {
  'Review export rows': 'Kagua mistari ya faili ya mishahara',
  'Payroll export rows': 'Mistari ya faili ya mishahara',
  'Row {{number}} · {{worker}} · {{start}} · {{minutes}} minutes': 'Mstari {{number}} · {{worker}} · {{start}} · dakika {{minutes}}',
  'Already requeued': 'Tayari umewekwa tena kwenye foleni',
  'Create retry for failed rows': 'Tengeneza jaribio jipya kwa mistari iliyoshindwa',
  'Select at least one failed row to create a retry export.': 'Chagua angalau mstari mmoja ulioshindwa ili kutengeneza faili la jaribio jipya.',
  'Enter why the external payroll system rejected these rows (at least 10 characters).': 'Weka sababu mfumo wa mishahara wa nje ulikataa mistari hii (angalau herufi 10).',
  'Enter the external rejection reference, or leave blank.': 'Weka rejeleo la kukataliwa kwa nje, au uache wazi.',
  'External rejection reference must be at least 3 characters.': 'Rejeleo la kukataliwa kwa nje lazima liwe na angalau herufi 3.',
  'A retry export was created for only the selected failed rows. The export has not been filed or paid.': 'Faili la jaribio jipya limetengenezwa kwa mistari iliyoshindwa uliyochagua pekee. Faili halijawasilishwa wala kulipwa.',
});
const planCopy = {
  am: ['ለእርስዎ ሚና የሚገኙ የAfroLife መሠረታዊ መሣሪያዎች፦ ደንበኞች፣ ሠራተኞች፣ ጥያቄዎች፣ ውሎች እና ዝርዝሮች።', 'የPro ዕቅድ ጥያቄ ብቻ ነው። ለወደፊት የሚከፈሉ አገልግሎቶች የክፍያ ሥርዓትና ማግበር ይፈልጋሉ።', 'የEnterprise ዕቅድ ጥያቄ ብቻ ነው። የቡድን ሪፖርት ክፍያና ማግበር እስኪዘጋጅ ድረስ አይሠራም።'],
  om: ['Meeshaalee AfroLife gahee keessaniif jiran: maamiltoota, hojjettoota, gaaffii, waliigaltee fi tarreeffama.', 'Karoora Pro filachuun gaaffii qofa. Tajaajilli kaffaltii gara fuulduraa kaffaltii fi hojii irra oolchuu barbaada.', 'Karoora Enterprise filachuun gaaffii qofa. Gabaasni garee hanga kaffaltii fi hojii irra oolutti hin jiru.'],
  ti: ['ን ሓላፍነትኩም ዝምልከቱ መሰረታዊ መሳርሒታት AfroLife፦ ዓማዊል፣ ሰራሕተኛታት፣ ሕቶታት፣ ውዕላትን ዝርዝራትን።', 'መደብ Pro ሕቶ ጥራይ እዩ። ናይ መጻኢ ዝኽፈሉ ኣገልግሎታት ክፍሊትን ምንቃሕን ይጠልቡ።', 'መደብ Enterprise ሕቶ ጥራይ እዩ። ሪፖርት ጉጅለ ክፍሊትን ምንቃሕን ክሳብ ዝዳሎ ኣይሰርሕን።'],
  so: ['Qalabka AfroLife ee doorkaaga: macaamiil, shaqaale, codsiyo, heshiisyo iyo liisaska.', 'Pro waa codsi qorshe oo keliya. Adeegyada lacagta leh ee mustaqbalka waxay u baahan yihiin lacag-bixin iyo hawlgelin.', 'Enterprise waa codsi qorshe oo keliya. Warbixinta kooxda ma shaqaynayso ilaa lacag-bixin iyo hawlgelin la diyaariyo.'],
  ar: ['أدوات AfroLife المتاحة لدورك: العملاء والعمال والطلبات والعقود والقوائم.', 'اختيار Pro طلب فقط. الميزات المدفوعة مستقبلًا تحتاج إلى إعداد الدفع والتفعيل.', 'اختيار Enterprise طلب فقط. تقارير الفريق غير متاحة حتى إعداد الدفع والتفعيل.'],
  sw: ['Zana za AfroLife za jukumu lako: wateja, wafanyakazi, maombi, mikataba na matangazo.', 'Pro ni ombi la mpango tu. Huduma za kulipia za baadaye zinahitaji malipo na kuwezeshwa.', 'Enterprise ni ombi la mpango tu. Ripoti za timu hazipatikani hadi malipo na kuwezeshwa viandaliwe.'],
};
for (const [locale, [free, pro, enterprise]] of Object.entries(planCopy)) {
  addedLanguages[locale]['Core AfroLife tools for your role, including lead, worker, request, contract and listing workflows.'] = free;
  addedLanguages[locale]['Pro is a plan request only. Future paid features require billing and activation.'] = pro;
  addedLanguages[locale]['Enterprise is a plan request only. Team reporting is not active until billing and activation are configured.'] = enterprise;
  Object.assign(catalogs[locale], addedLanguages[locale]);
}
addedLanguages.sw['Region'] = 'Mkoa'; addedLanguages.sw['City'] = 'Jiji'; addedLanguages.sw['Sub-city'] = 'Sehemu ya jiji'; addedLanguages.sw['Woreda'] = 'Woreda'; addedLanguages.sw['Kebele'] = 'Kebele'; addedLanguages.sw['Territory'] = 'Eneo';
addedLanguages.sw['Pro plan — ETB {{amount}} per month'] = 'Mpango wa Pro — ETB {{amount}} kwa mwezi';
addedLanguages.sw['Enterprise plan — ETB {{amount}} per month'] = 'Mpango wa Enterprise — ETB {{amount}} kwa mwezi';for (const [locale, messages] of Object.entries(addedLanguages)) Object.assign(catalogs[locale], messages);
const publicSurfaceTranslations = {
  'One Platform. Endless Possibilities.': {
    am: 'አንድ መድረክ። ወሰን የሌላቸው እድሎች።',
  },
  'Forgot your password?': {
    am: 'የይለፍ ቃልዎን ረሱ?',
  },
  'Contact your organization’s administrator for help resetting your password. Self-service password reset is not available on this page.': {
    am: 'የይለፍ ቃልዎን ለማስጀመር እገዛ ለማግኘት የድርጅትዎን አስተዳዳሪ ያነጋግሩ። በዚህ ገጽ ላይ በራስዎ የይለፍ ቃል ማስጀመር አይቻልም።',
  },
  'Skip to content': {
    am: 'ወደ ይዘቱ ይሂዱ', om: 'Gara qabiyyeetti darbi', ti: 'ናብ ትሕዝቶ ዝለል', so: 'U bood nuxurka', ar: 'انتقل إلى المحتوى', sw: 'Ruka hadi kwenye maudhui',
  },
  'Language': {
    am: 'ቋንቋ', om: 'Afaan', ti: 'ቋንቋ', so: 'Luqad', ar: 'اللغة', sw: 'Lugha',
  },
  'Select Master Agent': {
    am: 'ዋና ወኪል ይምረጡ', om: 'Bakka bu’aa olaanaa filadhaa', ti: 'ዋና ወኪል ምረጹ', so: 'Dooro wakiilka sare', ar: 'اختر الوكيل الرئيسي', sw: 'Chagua wakala mkuu',
  },
  'Choose master agent': {
    am: 'ዋና ወኪል ይምረጡ', om: 'Bakka bu’aa olaanaa filadhaa', ti: 'ዋና ወኪል ምረጹ', so: 'Dooro wakiilka sare', ar: 'اختر الوكيل الرئيسي', sw: 'Chagua wakala mkuu',
  },
  'The account already has this role.': {
    am: 'መለያው ይህ ሚና አስቀድሞ ተመድቦለታል።', om: 'Herregni gahee kana duraan qaba.', ti: 'እቲ ሕሳብ እዚ ግደ እዚ ድሮ ኣለዎ።', so: 'Akoontigu hore ayuu u leeyahay doorkan.', ar: 'لدى الحساب هذا الدور بالفعل.', sw: 'Akaunti tayari ina jukumu hili.',
  },
  'Account role saved.': {
    am: 'የመለያ ሚና ተቀምጧል።', om: 'Gaheen herregaa olkaa’ameera.', ti: 'ግደ ሕሳብ ተቐሚጡ ኣሎ።', so: 'Doorka akoontiga waa la keydiyay.', ar: 'تم حفظ دور الحساب.', sw: 'Jukumu la akaunti limehifadhiwa.',
  },
  'Filters and exports include the 200 most recent reports currently loaded.': {
    am: 'ማጣሪያዎችና ወደ ፋይል ማውጣት አሁን የተጫኑትን 200 የቅርብ ጊዜ ሪፖርቶች ያካትታሉ።', om: 'Filteerii fi al-ergiin gabaasa 200 yeroo dhihoo kana fe’aman hammatu.', ti: 'ማጣርያታትን ናብ ፋይል ምውጻእን እቶም ኣብዚ ዝተጻዕኑ 200 ናይ ቀረባ ግዜ ጸብጻባት የጠቓልሉ።', so: 'Shaandhaynta iyo dhoofintu waxay ku jiraan 200-ka warbixinood ee ugu dambeeyay ee hadda la raray.', ar: 'تشمل عوامل التصفية والتصدير أحدث 200 تقرير تم تحميله حاليًا.', sw: 'Vichujio na uhamishaji vinajumuisha ripoti 200 za hivi karibuni zilizopakiwa sasa.',
  },
  'Install app': {
    am: 'መተግበሪያውን ይጫኑ', om: 'Appii fe’i', ti: 'መተግበሪ ጽዓን', so: 'Ku rakib abka', ar: 'تثبيت التطبيق', sw: 'Sakinisha programu',
  },
  'ETHIOLIFE REGISTRATION': {
    am: 'የETHIOLIFE ምዝገባ', om: 'Galmee ETHIOLIFE', ti: 'ምዝገባ ETHIOLIFE', so: 'Diiwaangelinta ETHIOLIFE', ar: 'تسجيل ETHIOLIFE', sw: 'Usajili wa ETHIOLIFE',
  },
  'Staff approval is required before sign-in. Your account will remain inactive until compliance review and activation are complete.': {
    am: 'ከመግባትዎ በፊት የሠራተኛ ፈቃድ ያስፈልጋል። የተገዢነት ግምገማና ማግበር እስኪጠናቀቁ ድረስ መለያዎ ንቁ አይሆንም።',
    om: 'Seenuun dura hayyamni hojjettootaa barbaachisa. Gamaaggamni fi hojii irra ooluun hamma xumuramutti herregni keessan hin hojjetu.',
    ti: 'ቅድሚ ምእታው ፍቓድ ሰራሕተኛ የድሊ። ግምገማን ምንቃሕን ክሳብ ዝውድኡ ሕሳብኩም ኣይንቀሳቐስን።',
    so: 'Oggolaanshaha shaqaalaha ayaa loo baahan yahay ka hor gelitaanka. Akoonkaagu ma shaqayn doono ilaa dib-u-eegista iyo hawlgelintu dhammaadaan.',
    ar: 'تُشترط موافقة الموظفين قبل تسجيل الدخول. سيظل حسابك غير نشط حتى اكتمال المراجعة والتفعيل.',
    sw: 'Idhini ya wafanyakazi inahitajika kabla ya kuingia. Akaunti yako haitatumika hadi ukaguzi na kuwezesha vikamilike.',
  },
  'Full name': {
    am: 'ሙሉ ስም', om: 'Maqaa guutuu', ti: 'ምሉእ ስም', so: 'Magaca oo buuxa', ar: 'الاسم الكامل', sw: 'Jina kamili',
  },
  'Email (optional)': {
    am: 'ኢሜይል (አማራጭ)', om: 'Imeelii (filannoo)', ti: 'ኢሜይል (ኣማራጺ)', so: 'Iimayl (ikhtiyaari)', ar: 'البريد الإلكتروني (اختياري)', sw: 'Barua pepe (hiari)',
  },
  'Password confirmation': {
    am: 'የይለፍ ቃል ማረጋገጫ', om: 'Mirkaneessa jecha icciitii', ti: 'ምርግጋጽ መሕለፊ ቃል', so: 'Xaqiijinta erayga sirta', ar: 'تأكيد كلمة المرور', sw: 'Thibitisha nenosiri',
  },
  'Select an account type': {
    am: 'የመለያ ዓይነት ይምረጡ', om: 'Gosa herregaa filadhaa', ti: 'ዓይነት ሕሳብ ምረጹ', so: 'Dooro nooca akoontiga', ar: 'اختر نوع الحساب', sw: 'Chagua aina ya akaunti',
  },
  'Service interests (no charge today)': {
    am: 'የአገልግሎት ፍላጎቶች (ዛሬ ክፍያ የለም)', om: 'Fedhii tajaajilaa (har’a kaffaltiin hin jiru)', ti: 'ፍላጎታት ኣገልግሎት (ሎሚ ክፍሊት የለን)', so: 'Adeegyada aad danaynayso (maanta lacag ma jirto)', ar: 'الخدمات التي تهمك (لا توجد رسوم اليوم)', sw: 'Huduma unazopendelea (hakuna malipo leo)',
  },
  'Request AfroLife Edir membership': {
    am: 'የAfroLife እድር አባልነት ይጠይቁ', om: 'Miseensummaa Edir AfroLife gaafadhaa', ti: 'ኣባልነት Edir AfroLife ሕተቱ', so: 'Codso xubinnimada AfroLife Edir', ar: 'اطلب عضوية إدير في AfroLife', sw: 'Omba uanachama wa AfroLife Edir',
  },
  'After KYC verification, you can review the currently available community and financial products before requesting enrollment.': {
    am: 'ከKYC ማረጋገጫ በኋላ ምዝገባ ከመጠየቅዎ በፊት ያሉትን የማህበረሰብና የፋይናንስ ምርቶች ማየት ይችላሉ።',
    om: 'Mirkaneessa KYC booda, galmee gaafachuu dura oomisha hawaasummaa fi faayinaansii yeroo ammaa jiran ilaaluu dandeessu.',
    ti: 'ድሕሪ ምርግጋጽ KYC፡ ኣባልነት ቅድሚ ምሕታትኩም ኣብዚ ግዜ ዘለዉ ማሕበረሰባዊን ፋይናንሳዊን ፍርያት ክትርእዩ ትኽእሉ።',
    so: 'Kadib xaqiijinta KYC, waxaad eegi kartaa adeegyada bulshada iyo maaliyadda ee hadda jira ka hor codsiga xubinnimada.',
    ar: 'بعد التحقق من KYC، يمكنك مراجعة منتجات المجتمع والمنتجات المالية المتاحة حاليًا قبل طلب الانضمام.',
    sw: 'Baada ya uthibitishaji wa KYC, unaweza kukagua huduma za jamii na bidhaa za kifedha zilizopo kabla ya kuomba kujiunga.',
  },
  'Identity documents': {
    am: 'የመታወቂያ ሰነዶች', om: 'Sanadoota eenyummaa', ti: 'ሰነዳት መንነት', so: 'Dukumentiyada aqoonsiga', ar: 'وثائق الهوية', sw: 'Nyaraka za utambulisho',
  },
  'Choose an account type to see required documents.': {
    am: 'የሚፈለጉ ሰነዶችን ለማየት የመለያ ዓይነት ይምረጡ።', om: 'Sanadoota barbaachisan arguuf gosa herregaa filadhaa.', ti: 'ዝድለዩ ሰነዳት ንምርኣይ ዓይነት ሕሳብ ምረጹ።', so: 'Dooro nooca akoontiga si aad u aragto dukumentiyada loo baahan yahay.', ar: 'اختر نوع الحساب لعرض الوثائق المطلوبة.', sw: 'Chagua aina ya akaunti ili kuona nyaraka zinazohitajika.',
  },
  'Required documents: {{documents}}. Upload PDF, JPEG or PNG files up to 10 MB each.': {
    am: 'የሚፈለጉ ሰነዶች፦ {{documents}}። እስከ 10 MB የሆነ PDF፣ JPEG ወይም PNG ይጫኑ።',
    om: 'Sanadoota barbaachisan: {{documents}}. Faayiloota PDF, JPEG yookaan PNG hanga 10 MB olkaa’aa.',
    ti: 'ዝድለዩ ሰነዳት፦ {{documents}}። PDF፣ JPEG ወይ PNG ክሳብ 10 MB ጽዓኑ።',
    so: 'Dukumentiyada loo baahan yahay: {{documents}}. Soo geli PDF, JPEG ama PNG aan ka badnayn 10 MB.',
    ar: 'الوثائق المطلوبة: {{documents}}. ارفع ملف PDF أو JPEG أو PNG بحجم لا يتجاوز 10 ميغابايت.',
    sw: 'Nyaraka zinazohitajika: {{documents}}. Pakia PDF, JPEG au PNG isiyozidi MB 10.',
  },
  'Could not confirm document requirements for this account type. Please retry loading signup requirements.': {
    am: 'ለዚህ የመለያ ዓይነት የሰነድ መስፈርቶችን ማረጋገጥ አልተቻለም። የምዝገባ መስፈርቶችን እንደገና ይጫኑ።',
    om: 'Ulaagaalee sanadaa gosa herregaa kanaaf mirkaneessuun hin danda’amne. Ulaagaalee galmee irra deebi’anii fe’aa.',
    ti: 'መስፈርታት ሰነድ ናይዚ ዓይነት ሕሳብ ምርግጋጽ ኣይተኻእለን። መስፈርታት ምዝገባ እንደገና ጽዓኑ።',
    so: 'Lama xaqiijin karo shuruudaha dukumentiga noocan akoontiga. Mar kale soo rar shuruudaha diiwaangelinta.',
    ar: 'تعذر تأكيد متطلبات الوثائق لهذا النوع من الحساب. أعد تحميل متطلبات التسجيل.',
    sw: 'Haikuwezekana kuthibitisha mahitaji ya nyaraka kwa aina hii ya akaunti. Pakia tena mahitaji ya usajili.',
  },
  'Choose a territory from the suggestions.': {
    am: 'ከቀረቡት አማራጮች አካባቢ ይምረጡ።', om: 'Yaada dhiyaate keessaa naannoo filadhaa.', ti: 'ካብ ዝቐረቡ ምርጫታት ከባቢ ምረጹ።', so: 'Ka dooro deegaanada la soo jeediyay.', ar: 'اختر منطقة من الاقتراحات.', sw: 'Chagua eneo kutoka kwenye mapendekezo.',
  },
  'Choose a region or type a territory name.': {
    am: 'ክልል ይምረጡ ወይም የአካባቢ ስም ይጻፉ።',
    om: 'Naannoo filadhaa yookaan maqaa naannoo barreessaa.',
    ti: 'ክልል ምረጹ ወይ ስም ከባቢ ጽሓፉ።',
    so: 'Dooro gobol ama qor magaca deegaanka.',
    ar: 'اختر إقليمًا أو اكتب اسم المنطقة.',
    sw: 'Chagua eneo au uandike jina la eneo.',
  },
  'Join AfroLife Edir': {
    am: 'AfroLife Edirን ይቀላቀሉ', om: 'AfroLife Edir waliin makamaa', ti: 'AfroLife Edir ተጸንበሩ', so: 'Ku biir AfroLife Edir', ar: 'انضم إلى AfroLife Edir', sw: 'Jiunge na AfroLife Edir',
  },
  'Register an Edir': {
    am: 'እድር ይመዝግቡ', om: 'Edir galmeessaa', ti: 'Edir መዝግቡ', so: 'Diiwaangeli Edir', ar: 'سجّل إدير', sw: 'Sajili Edir',
  },
  'EDIR ONBOARDING': {
    am: 'የእድር ምዝገባ', om: 'Galmee Edir', ti: 'ምዝገባ Edir', so: 'Diiwaangelinta Edir', ar: 'تسجيل إدير', sw: 'Usajili wa Edir',
  },
  'Apply to register an independent Edir': {
    am: 'ገለልተኛ እድር ለመመዝገብ ያመልክቱ', om: 'Edir of danda’e galmeessuuf iyyadhaa', ti: 'ናጻ Edir ንምምዝጋብ ኣመልክቱ', so: 'Codso diiwaangelinta Edir madax-bannaan', ar: 'قدّم طلب تسجيل إدير مستقل', sw: 'Omba kusajili Edir huru',
  },
  'The umbrella Master Edir reviews applications. If approved, your Edir keeps its own governance, administration, and operational records.': {
    am: 'ዋናው የእድር ማህበር ማመልከቻዎችን ይገመግማል። ከተፈቀደ፣ እድርዎ የራሱን አስተዳደር፣ ሥራ አመራርና የሥራ መዝገቦች ይይዛል።',
    om: 'Edir guddaan iyyannoowwan ni gamaaggama. Yoo ragga’e, Edir keessan bulchiinsa, hooggansa fi galmeewwan hojii mataa isaa qabaata.',
    ti: 'ዋና Edir ነቶም መመልከቲታት ይግምግሞም። እንተተፈቒዱ፡ Edirኩም ናይ ገዛእ ርእሱ ምምሕዳር፣ ኣሰራርሓን መዝገባትን ይዕቅብ።',
    so: 'Edir-ka guud ayaa dib u eegaya codsiyada. Haddii la oggolaado, Edir-kaagu wuxuu yeelanayaa maamul iyo diiwaanno u gaar ah.',
    ar: 'يراجع إدير الرئيسي الطلبات. وإذا تمت الموافقة، يحتفظ إدير الخاص بك بحوكمته وإدارته وسجلاته التشغيلية المستقلة.',
    sw: 'Edir Kuu inakagua maombi. Ikiidhinishwa, Edir yako itahifadhi utawala, usimamizi na kumbukumbu zake yenyewe.',
  },
  'Edir display name': {
    am: 'የእድር ማሳያ ስም', om: 'Maqaa Edir agarsiisaa', ti: 'ስም መርኣያ Edir', so: 'Magaca Edir ee la muujinayo', ar: 'اسم إدير المعروض', sw: 'Jina la Edir litakaloonekana',
  },
  'Legal name': {
    am: 'ሕጋዊ ስም', om: 'Maqaa seeraa', ti: 'ሕጋዊ ስም', so: 'Magaca sharciga ah', ar: 'الاسم القانوني', sw: 'Jina la kisheria',
  },
  'Registration reference (optional)': {
    am: 'የምዝገባ ማጣቀሻ (አማራጭ)', om: 'Wabii galmee (filannoo)', ti: 'መወከሲ ምዝገባ (ኣማራጺ)', so: 'Tixraaca diiwaangelinta (ikhtiyaari)', ar: 'مرجع التسجيل (اختياري)', sw: 'Nambari ya usajili (hiari)',
  },
  'Bylaws or governance reference (optional)': {
    am: 'የደንብ ወይም የአስተዳደር ማጣቀሻ (አማራጭ)', om: 'Wabii dambii yookaan bulchiinsaa (filannoo)', ti: 'መወከሲ ደንቢ ወይ ምምሕዳር (ኣማራጺ)', so: 'Tixraaca xeer-hoosaadka ama maamulka (ikhtiyaari)', ar: 'مرجع اللوائح أو الحوكمة (اختياري)', sw: 'Rejea ya katiba au utawala (hiari)',
  },
  'Contact person': {
    am: 'የመገናኛ ሰው', om: 'Nama qunnamtii', ti: 'ሰብ ርክብ', so: 'Qofka lala xiriirayo', ar: 'الشخص المسؤول للتواصل', sw: 'Mtu wa mawasiliano',
  },
  'Contact phone': {
    am: 'የመገናኛ ስልክ', om: 'Bilbila qunnamtii', ti: 'ስልኪ ርክብ', so: 'Telefoonka xiriirka', ar: 'هاتف التواصل', sw: 'Simu ya mawasiliano',
  },
  'Official legal registration certificate (PDF, JPEG or PNG · max 10 MB)': {
    am: 'ኦፊሴላዊ የሕጋዊ ምዝገባ ማረጋገጫ (PDF, JPEG ወይም PNG · እስከ 10 MB)',
    om: 'Ragaa galmee seeraa ofiishaalaa (PDF, JPEG yookaan PNG · hanga 10 MB)',
    ti: 'ወግዓዊ ሕጋዊ ምስክር ወረቐት ምዝገባ (PDF፣ JPEG ወይ PNG · ክሳብ 10 MB)',
    so: 'Shahaadada rasmiga ah ee diiwaangelinta sharciga (PDF, JPEG ama PNG · ugu badnaan 10 MB)',
    ar: 'شهادة التسجيل القانوني الرسمية (PDF أو JPEG أو PNG · بحد أقصى 10 ميغابايت)',
    sw: 'Cheti rasmi cha usajili wa kisheria (PDF, JPEG au PNG · hadi MB 10)',
  },
  'Governance or bylaws document (PDF, JPEG or PNG · max 10 MB)': {
    am: 'የአስተዳደር ወይም የደንብ ሰነድ (PDF, JPEG ወይም PNG · እስከ 10 MB)',
    om: 'Sanada bulchiinsaa yookaan dambii (PDF, JPEG yookaan PNG · hanga 10 MB)',
    ti: 'ሰነድ ምምሕዳር ወይ ደንቢ (PDF፣ JPEG ወይ PNG · ክሳብ 10 MB)',
    so: 'Dukumentiga maamulka ama xeer-hoosaadka (PDF, JPEG ama PNG · ugu badnaan 10 MB)',
    ar: 'وثيقة الحوكمة أو اللوائح الداخلية (PDF أو JPEG أو PNG · بحد أقصى 10 ميغابايت)',
    sw: 'Hati ya utawala au katiba (PDF, JPEG au PNG · hadi MB 10)',
  },
  'Consent to application review': {
    am: 'ለማመልከቻ ግምገማ ፈቃድ', om: 'Gamaaggama iyyannoo irratti walii galuu', ti: 'ፍቓድ ግምገማ መመልከቲ', so: 'Oggolaanshaha dib-u-eegista codsiga', ar: 'الموافقة على مراجعة الطلب', sw: 'Idhini ya ukaguzi wa ombi',
  },
  'I authorize AfroLife Master Edir to use these organization and contact details to review this registration application. Approval does not replace the Edir’s own legal or governance obligations.': {
    am: 'AfroLife Master Edir ይህን የድርጅትና የመገናኛ መረጃ የምዝገባ ማመልከቻውን ለመገምገም እንዲጠቀም ፈቅጃለሁ። ፈቃድ የእድሩን ሕጋዊና የአስተዳደር ግዴታዎች አይተካም።',
    om: 'AfroLife Master Edir odeeffannoo dhaabbataa fi qunnamtii kana iyyannoo galmee kana gamaaggamuuf akka fayyadamu nan hayyama. Ragga’iinsi dirqama seeraa fi bulchiinsa Edir bakka hin bu’u.',
    ti: 'AfroLife Master Edir ነዚ ሓበሬታ ትካልን ርክብን ንምግምጋም መመልከቲ ክጥቀመሉ እፈቅድ። ምፍቃድ ግዴታታት ሕጊን ምምሕዳርን ናይ Edir ኣይትክእን።',
    so: 'Waxaan oggolaanayaa in AfroLife Master Edir u isticmaalo xogtan ururka iyo xiriirka si uu u eego codsigan. Oggolaanshuhu ma beddelayo waajibaadka sharci iyo maamul ee Edir-ka.',
    ar: 'أفوّض AfroLife Master Edir باستخدام بيانات المؤسسة والتواصل هذه لمراجعة طلب التسجيل. ولا تحل الموافقة محل الالتزامات القانونية أو الحوكمية الخاصة بإدير.',
    sw: 'Ninaidhinisha AfroLife Master Edir kutumia maelezo haya ya shirika na mawasiliano kukagua ombi hili. Idhini haibadilishi wajibu wa kisheria au utawala wa Edir yenyewe.',
  },
  'Submit Edir registration application': {
    am: 'የእድር ምዝገባ ማመልከቻ ያስገቡ', om: 'Iyyannoo galmee Edir ergaa', ti: 'መመልከቲ ምዝገባ Edir ኣቕርቡ', so: 'Gudbi codsiga diiwaangelinta Edir', ar: 'إرسال طلب تسجيل إدير', sw: 'Wasilisha ombi la usajili wa Edir',
  },
  'Change server': {
    am: 'አገልጋይ ቀይር', om: 'Sarvarii jijjiiri', ti: 'ሰርቨር ቀይር', so: 'Beddel server-ka', ar: 'تغيير الخادم', sw: 'Badilisha seva',
  },
  'Cancel server change': {
    am: 'የአገልጋይ ለውጥ ይተዉ', om: 'Jijjiirama sarvarii dhiisaa', ti: 'ለውጢ ሰርቨር ሰርዙ', so: 'Jooji beddelka server-ka', ar: 'إلغاء تغيير الخادم', sw: 'Ghairi mabadiliko ya seva',
  },
  'Connection settings': {
    am: 'የግንኙነት ቅንብሮች', om: 'Qindaa’ina walqunnamtii', ti: 'ቅጥዕታት ርክብ', so: 'Dejinta xiriirka', ar: 'إعدادات الاتصال', sw: 'Mipangilio ya muunganisho',
  },
  'Change the configured AfroLife server for this device. This affects only this app installation.': {
    am: 'ለዚህ መሣሪያ የተዋቀረውን የAfroLife አገልጋይ ይቀይሩ። ይህ ለዚህ መተግበሪያ ጭነት ብቻ ይሠራል።',
    om: 'Sarvarii AfroLife meeshaa kanaaf qindaa’e jijjiiraa. Jijjiiramni kun appii kana qofa irratti hojjeta.',
    ti: 'ንዚ መሳርሒ ዝተዳለወ ሰርቨር AfroLife ቀይሩ። እዚ ነዚ ጥራይ ዝተጻዕነ መተግበሪ ይጸልዎ።',
    so: 'Beddel server-ka AfroLife ee qalabkan loo dejiyey. Tani waxay saamaynaysaa rakibaaddan oo keliya.',
    ar: 'غيّر خادم AfroLife المُعدّ لهذا الجهاز. يؤثر ذلك على تثبيت هذا التطبيق فقط.',
    sw: 'Badilisha seva ya AfroLife iliyowekwa kwa kifaa hiki. Hili linaathiri usakinishaji huu wa programu pekee.',
  },
  'Workforce Management dashboard': {
    am: 'የሠራተኛ አስተዳደር ዳሽቦርድ', om: 'Daashboordii Bulchiinsa Hojjettootaa', ti: 'ዳሽቦርድ ምምሕዳር ሰራሕተኛ', so: 'Dashboard-ka Maamulka Shaqaalaha', ar: 'لوحة إدارة القوى العاملة', sw: 'Dashibodi ya Usimamizi wa Wafanyakazi',
  },
  'Staffing dashboard': {
    am: 'የሠራተኛ ማሰማራት ዳሽቦርድ', om: 'Daashboordii Ramaddii Hojjettootaa', ti: 'ዳሽቦርድ ምድባ ሰራሕተኛ', so: 'Dashboard-ka Shaqaale-qorista', ar: 'لوحة التوظيف', sw: 'Dashibodi ya Upangaji Wafanyakazi',
  },
  'Property sale and rental listings': {
    am: 'የሽያጭና ኪራይ ንብረቶች', om: 'Tarree qabeenya gurgurtaa fi kireeffannaa', ti: 'ዝርዝራት ንብረት ሽያጥን ኪራይን', so: 'Liisaska guryaha iibka iyo kirada', ar: 'قوائم العقارات للبيع والإيجار', sw: 'Orodha za mali za kuuza na kukodisha',
  },
  'Post and discover products, services, equipment and property with private photo and video uploads.': {
    am: 'ምስጢራዊ የፎቶና ቪዲዮ ሰቀላ በመጠቀም ምርቶችን፣ አገልግሎቶችን፣ መሣሪያዎችንና ንብረቶችን ያቅርቡ እና ያግኙ።', om: 'Suuraa fi viidiyoo dhuunfaa olkaa’uun oomisha, tajaajila, meeshaalee fi qabeenya maxxansaa fi barbaadaa.', ti: 'ምርታት፣ ኣገልግሎታት፣ መሳርሒታትን ንብረትን ብምስጢራዊ ምጽዓን ስእሊን ቪድዮን ኣቕርቡን ድለዩን።', so: 'Soo bandhig oo hel badeecooyin, adeegyo, qalab iyo hanti adigoo si gaar ah u gelinaya sawirro iyo muuqaallo.', ar: 'أضف واكتشف المنتجات والخدمات والمعدات والعقارات مع تحميل خاص للصور ومقاطع الفيديو.', sw: 'Chapisha na ugundue bidhaa, huduma, vifaa na mali kwa kupakia picha na video kwa faragha.',
  },
  'Create a listing': {
    am: 'ዝርዝር ይፍጠሩ', om: 'Tarree uumaa', ti: 'ዝርዝር ፍጠሩ', so: 'Samee liis', ar: 'إنشاء إعلان', sw: 'Unda tangazo',
  },
  'Listing domain': {
    am: 'የዝርዝር ምድብ', om: 'Gosa tarree', ti: 'ዓይነት ዝርዝር', so: 'Qaybta liiska', ar: 'فئة الإعلان', sw: 'Aina ya tangazo',
  },
  'Choose an active seller': {
    am: 'ንቁ ሻጭ ይምረጡ', om: 'Gurguraa hojii irra jiru filadhaa', ti: 'ንጡፍ ሸያጢ ምረጹ', so: 'Dooro iibiye firfircoon', ar: 'اختر بائعًا نشطًا', sw: 'Chagua muuzaji anayefanya kazi',
  },
  'Photos and videos (add at least one photo to post)': {
    am: 'ፎቶዎችና ቪዲዮዎች (ለማቅረብ ቢያንስ አንድ ፎቶ ያክሉ)', om: 'Suuraa fi viidiyoo (maxxansuuf yoo xiqqaate suuraa tokko dabalaa)', ti: 'ስእልታትን ቪድዮታትን (ንምልጣፍ እንተወሓደ ሓደ ስእሊ ወስኹ)', so: 'Sawirro iyo muuqaallo (ku dar ugu yaraan hal sawir si aad u daabacdo)', ar: 'الصور ومقاطع الفيديو (أضف صورة واحدة على الأقل للنشر)', sw: 'Picha na video (ongeza angalau picha moja ili kuchapisha)',
  },
  'No listings are available yet.': {
    am: 'እስካሁን ዝርዝር አልተገኘም።', om: 'Hanga ammaatti tarreen hin jiru.', ti: 'ክሳብ ሕጂ ዝርዝር የለን።', so: 'Weli ma jiraan liisas la heli karo.', ar: 'لا توجد إعلانات متاحة حتى الآن.', sw: 'Bado hakuna matangazo yanayopatikana.',
  },
  'For rent / hire': {
    am: 'ለኪራይ', om: 'Kireeffannaaf', ti: 'ንኪራይ', so: 'Kiro ah', ar: 'للإيجار', sw: 'Ya kukodisha',
  },
  'For sale': {
    am: 'ለሽያጭ', om: 'Gurgurtaaf', ti: 'ንሽያጥ', so: 'Iib ah', ar: 'للبيع', sw: 'Inauzwa',
  },
  'For rent': {
    am: 'ለኪራይ', om: 'Kireeffannaaf', ti: 'ንኪራይ', so: 'Kiro ah', ar: 'للإيجار', sw: 'Ya kukodisha',
  },
  'Sale or rent': {
    am: 'ሽያጭ ወይም ኪራይ', om: 'Gurgurtaa ykn kireeffannaa', ti: 'ሽያጥ ወይ ኪራይ', so: 'Iib ama kiro', ar: 'للبيع أو الإيجار', sw: 'Kuuza au kukodisha',
  },
  'Listing transaction': {
    am: 'የዝርዝር ግብይት', om: 'Daldala tarree', ti: 'ግብይት ዝርዝር', so: 'Macaamilka liiska', ar: 'نوع المعاملة للإعلان', sw: 'Muamala wa tangazo',
  },
  'Rental period': {
    am: 'የኪራይ ጊዜ', om: 'Yeroo kireeffannaa', ti: 'እዋን ኪራይ', so: 'Muddada kirada', ar: 'مدة الإيجار', sw: 'Kipindi cha upangishaji',
  },
  'Sale price (ETB)': {
    am: 'የሽያጭ ዋጋ (ብር)', om: 'Gatii gurgurtaa (ETB)', ti: 'ዋጋ ሽያጥ (ETB)', so: 'Qiimaha iibka (ETB)', ar: 'سعر البيع (ETB)', sw: 'Bei ya kuuza (ETB)',
  },
  'Price (ETB)': {
    am: 'ዋጋ (ብር)', om: 'Gatii (ETB)', ti: 'ዋጋ (ETB)', so: 'Qiimaha (ETB)', ar: 'السعر (ETB)', sw: 'Bei (ETB)',
  },
  'Daily': {
    am: 'በየቀኑ', om: 'Guyyaa guyyaan', ti: 'መዓልታዊ', so: 'Maalinle', ar: 'يومي', sw: 'Kila siku',
  },
  'Weekly': {
    am: 'በየሳምንቱ', om: 'Torban torbaniin', ti: 'ሰሙናዊ', so: 'Toddobaadle', ar: 'أسبوعي', sw: 'Kila wiki',
  },
  'Monthly': {
    am: 'በየወሩ', om: 'Ji’a ji’aan', ti: 'ወርሓዊ', so: 'Bille ah', ar: 'شهري', sw: 'Kila mwezi',
  },
  'Yearly': {
    am: 'በየዓመቱ', om: 'Wagga waggaan', ti: 'ዓመታዊ', so: 'Sannadle', ar: 'سنوي', sw: 'Kila mwaka',
  },
  'Post listing': {
    am: 'ዝርዝሩን አቅርብ', om: 'Tarree maxxansi', ti: 'ዝርዝር ኣቕርብ', so: 'Daabac liiska', ar: 'نشر الإعلان', sw: 'Chapisha tangazo',
  },
  'Published listings available': {
    am: 'የታተሙ ዝርዝሮች ይገኛሉ', om: 'Tarreewwan maxxanfaman ni jiru', ti: 'ዝተሓትሙ ዝርዝራት ይርከቡ', so: 'Liisaska la daabacay ee la heli karo', ar: 'الإعلانات المنشورة المتاحة', sw: 'Matangazo yaliyochapishwa yanapatikana',
  },
  'Browse available properties, prices, rental terms, and listing media.': {
    am: 'ያሉ ንብረቶችን፣ ዋጋዎችን፣ የኪራይ ውሎችንና ሚዲያዎችን ይመልከቱ።', om: 'Qabeenya jiru, gatii, haalawwan kireeffannaa fi miidiyaa tarree ilaalaa.', ti: 'ዘለዉ ንብረታት፣ ዋጋታት፣ ውዕላት ኪራይን ሚድያን ርአዩ።', so: 'Eeg hantida la heli karo, qiimayaasha, shuruudaha kirada iyo warbaahinta.', ar: 'تصفح العقارات المتاحة والأسعار وشروط الإيجار ووسائط الإعلان.', sw: 'Vinjari mali zilizopo, bei, masharti ya upangishaji na media za matangazo.',
  },
  'No available property listings are currently published.': {
    am: 'በአሁኑ ጊዜ የታተመ የንብረት ዝርዝር የለም።', om: 'Amma tarreen qabeenyaa maxxanfame hin jiru.', ti: 'ኣብዚ ግዜ ዝተሓትመ ዝርዝር ንብረት የለን።', so: 'Hadda ma jiraan liisas hantiyeed oo la daabacay.', ar: 'لا توجد حاليًا قوائم عقارية منشورة.', sw: 'Kwa sasa hakuna matangazo ya mali yaliyochapishwa.',
  },
  'For sale · ETB {{amount}}': {
    am: 'ለሽያጭ · ብር {{amount}}', om: 'Gurgurtaaf · ETB {{amount}}', ti: 'ንሽያጥ · ETB {{amount}}', so: 'Iib ah · ETB {{amount}}', ar: 'للبيع · {{amount}} ETB', sw: 'Inauzwa · ETB {{amount}}',
  },
  'For rent · Price on request': {
    am: 'ለኪራይ · ዋጋውን ይጠይቁ', om: 'Kireeffannaaf · Gatii gaafadhaa', ti: 'ንኪራይ · ዋጋ ሕተቱ', so: 'Kiro ah · Weydii qiimaha', ar: 'للإيجار · السعر عند الطلب', sw: 'Ya kukodisha · Uliza bei',
  },
  'For rent from ETB {{amount}} / {{period}}': {
    am: 'ከብር {{amount}} / {{period}} ለኪራይ', om: 'Kireeffannaa ETB {{amount}} / {{period}} irraa', ti: 'ካብ ETB {{amount}} / {{period}} ንኪራይ', so: 'Kiro laga bilaabo ETB {{amount}} / {{period}}', ar: 'للإيجار ابتداءً من {{amount}} ETB / {{period}}', sw: 'Kodi kuanzia ETB {{amount}} / {{period}}',
  },
  'Property Management dashboard': {
    am: 'የንብረት አስተዳደር ዳሽቦርድ', om: 'Daashboordii Bulchiinsa Qabeenyaa', ti: 'ዳሽቦርድ ምምሕዳር ንብረት', so: 'Dashboard-ka Maamulka Hantida', ar: 'لوحة إدارة العقارات', sw: 'Dashibodi ya Usimamizi wa Mali',
  },
  'A summary of worker records available to your account. Counts use the currently loaded worker data only.': {
    am: 'ለመለያዎ የሚገኙ የሠራተኛ መዝገቦች ማጠቃለያ። ቁጥሮቹ አሁን በተጫነው የሠራተኛ መረጃ ላይ ብቻ የተመሠረቱ ናቸው።',
    om: 'Cuunfaa galmee hojjettootaa herrega keessaniif argamuu. Lakkoofsi odeeffannoo hojjetaa amma fe’ame qofa fayyadama.',
    ti: 'ጽማቕ ናይ ንሕሳብኩም ዝርከቡ መዝገባት ሰራሕተኛ። ቁጽርታት ኣብ እዋኑ ዝተጻዕነ ሓበሬታ ጥራይ ይጥቀሙ።',
    so: 'Soo koobid diiwaannada shaqaalaha ee akoonkaaga loo heli karo. Tiradu waxay ku salaysan tahay xogta shaqaalaha ee hadda la raray oo keliya.',
    ar: 'ملخص سجلات العاملين المتاحة لحسابك. تستند الأعداد إلى بيانات العاملين المحمّلة حاليًا فقط.',
    sw: 'Muhtasari wa rekodi za wafanyakazi zinazopatikana kwenye akaunti yako. Hesabu hutumia data ya wafanyakazi iliyopakiwa sasa pekee.',
  },
  'A summary of staffing requests available to your account. Counts use the currently loaded request data only.': {
    am: 'ለመለያዎ የሚገኙ የሠራተኛ ጥያቄዎች ማጠቃለያ። ቁጥሮቹ አሁን በተጫነው የጥያቄ መረጃ ላይ ብቻ የተመሠረቱ ናቸው።',
    om: 'Cuunfaa gaaffii ramaddii hojii herrega keessaniif argamuu. Lakkoofsi gaaffii amma fe’ame qofa fayyadama.',
    ti: 'ጽማቕ ሕቶታት ስራሕ ንሕሳብኩም ዝርከቡ። ቁጽርታት ኣብ እዋኑ ዝተጻዕነ ሓበሬታ ሕቶ ጥራይ ይጥቀሙ።',
    so: 'Soo koobid codsiyada shaqaalaha ee akoonkaaga loo heli karo. Tiradu waxay ku salaysan tahay xogta codsiyada hadda la raray oo keliya.',
    ar: 'ملخص طلبات التوظيف المتاحة لحسابك. تستند الأعداد إلى بيانات الطلبات المحمّلة حاليًا فقط.',
    sw: 'Muhtasari wa maombi ya wafanyakazi yanayopatikana kwenye akaunti yako. Hesabu hutumia data ya maombi iliyopakiwa sasa pekee.',
  },
  'A summary of property listings available to your account. Counts use the currently loaded listing data only.': {
    am: 'ለመለያዎ የሚገኙ የንብረት ዝርዝሮች ማጠቃለያ። ቁጥሮቹ አሁን በተጫነው የዝርዝር መረጃ ላይ ብቻ የተመሠረቱ ናቸው።',
    om: 'Cuunfaa tarree qabeenyaa herrega keessaniif argamuu. Lakkoofsi tarree amma fe’ame qofa fayyadama.',
    ti: 'ጽማቕ ዝርዝራት ንብረት ንሕሳብኩም ዝርከቡ። ቁጽርታት ኣብ እዋኑ ዝተጻዕነ ዝርዝር ጥራይ ይጥቀሙ።',
    so: 'Soo koobid liisaska hantida ee akoonkaaga loo heli karo. Tiradu waxay ku salaysan tahay xogta liisaska hadda la raray oo keliya.',
    ar: 'ملخص قوائم العقارات المتاحة لحسابك. تستند الأعداد إلى بيانات القوائم المحمّلة حاليًا فقط.',
    sw: 'Muhtasari wa matangazo ya mali yanayopatikana kwenye akaunti yako. Hesabu hutumia data ya matangazo iliyopakiwa sasa pekee.',
  },
  'Dashboard information could not be loaded. Select Refresh to try again.': {
    am: 'የዳሽቦርድ መረጃውን መጫን አልተቻለም። እንደገና ለመሞከር አድስን ይምረጡ።',
    om: 'Odeeffannoo daashboordii fe’uun hin danda’amne. Irra deebi’uuf Haaromsi filadhaa.',
    ti: 'ሓበሬታ ዳሽቦርድ ምጽዓን ኣይተኻእለን። እንደገና ንምፍታን ኣሐድስ ምረጹ።',
    so: 'Lama rarik karo xogta dashboard-ka. Dooro Cusboonaysii si aad mar kale isugu daydo.',
    ar: 'تعذر تحميل معلومات لوحة المعلومات. اختر تحديث للمحاولة مجددًا.',
    sw: 'Imeshindikana kupakia taarifa za dashibodi. Chagua Onyesha upya ili ujaribu tena.',
  },
  'No worker records are currently available for this dashboard.': {
    am: 'ለዚህ ዳሽቦርድ አሁን የሠራተኛ መዝገብ የለም።', om: 'Daashboordii kanaaf galmeen hojjetaa amma hin jiru.', ti: 'ንዚ ዳሽቦርድ ኣብዚ ግዜ መዝገብ ሰራሕተኛ የለን።', so: 'Hadda ma jiraan diiwaanno shaqaale oo dashboard-kan loo heli karo.', ar: 'لا توجد حاليًا سجلات عاملين متاحة لهذه اللوحة.', sw: 'Kwa sasa hakuna rekodi za wafanyakazi zinazopatikana kwenye dashibodi hii.',
  },
  'No staffing requests are currently available for this dashboard.': {
    am: 'ለዚህ ዳሽቦርድ አሁን የሠራተኛ ጥያቄ የለም።', om: 'Daashboordii kanaaf gaaffiin hojii amma hin jiru.', ti: 'ንዚ ዳሽቦርድ ኣብዚ ግዜ ሕቶ ስራሕ የለን።', so: 'Hadda ma jiraan codsiyo shaqaale oo dashboard-kan loo heli karo.', ar: 'لا توجد حاليًا طلبات توظيف متاحة لهذه اللوحة.', sw: 'Kwa sasa hakuna maombi ya wafanyakazi yanayopatikana kwenye dashibodi hii.',
  },
  'No property listings are currently available for this dashboard.': {
    am: 'ለዚህ ዳሽቦርድ አሁን የንብረት ዝርዝር የለም።', om: 'Daashboordii kanaaf tarreen qabeenyaa amma hin jiru.', ti: 'ንዚ ዳሽቦርድ ኣብዚ ግዜ ዝርዝር ንብረት የለን።', so: 'Hadda ma jiraan liisas hantiyeed oo dashboard-kan loo heli karo.', ar: 'لا توجد حاليًا قوائم عقارية متاحة لهذه اللوحة.', sw: 'Kwa sasa hakuna matangazo ya mali yanayopatikana kwenye dashibodi hii.',
  },
  'Registered workers': {
    am: 'የተመዘገቡ ሠራተኞች', om: 'Hojjettoota galmaa’an', ti: 'ዝተመዝገቡ ሰራሕተኛታት', so: 'Shaqaale diiwaangashan', ar: 'العاملون المسجلون', sw: 'Wafanyakazi waliosajiliwa',
  },
  'Service requests': {
    am: 'የአገልግሎት ጥያቄዎች', om: 'Gaaffii tajaajilaa', ti: 'ሕቶታት ኣገልግሎት', so: 'Codsiyada adeegga', ar: 'طلبات الخدمة', sw: 'Maombi ya huduma',
  },
  'Property listings': {
    am: 'የንብረት ዝርዝሮች', om: 'Tarree qabeenyaa', ti: 'ዝርዝራት ንብረት', so: 'Liisaska hantida', ar: 'قوائم العقارات', sw: 'Matangazo ya mali',
  },
  'Units in listed properties': {
    am: 'በተዘረዘሩ ንብረቶች ያሉ ክፍሎች', om: 'Kutaa qabeenya tarreeffame keessaa', ti: 'ኣብ ዝተዘርዘሩ ንብረታት ዘለዉ ክፍልታት', so: 'Qaybaha ku jira hantida la taxay', ar: 'الوحدات في العقارات المدرجة', sw: 'Vitengo katika mali zilizoorodheshwa',
  },
  'Worker verification status': {
    am: 'የሠራተኛ ማረጋገጫ ሁኔታ', om: 'Haala mirkaneessa hojjetaa', ti: 'ኩነታት ምርግጋጽ ሰራሕተኛ', so: 'Xaaladda xaqiijinta shaqaalaha', ar: 'حالة التحقق من العامل', sw: 'Hali ya uthibitishaji wa mfanyakazi',
  },
  'Request status': {
    am: 'የጥያቄ ሁኔታ', om: 'Haala gaaffii', ti: 'ኩነታት ሕቶ', so: 'Xaaladda codsiga', ar: 'حالة الطلب', sw: 'Hali ya ombi',
  },
  'Listing status': {
    am: 'የዝርዝር ሁኔታ', om: 'Haala tarree', ti: 'ኩነታት ዝርዝር', so: 'Xaaladda liiska', ar: 'حالة القائمة', sw: 'Hali ya tangazo',
  },
  'Status': {
    am: 'ሁኔታ', om: 'Haala', ti: 'ኩነታት', so: 'Xaalad', ar: 'الحالة', sw: 'Hali',
  },
  'Count': {
    am: 'ብዛት', om: 'Lakkoofsa', ti: 'ቁጽሪ', so: 'Tiro', ar: 'العدد', sw: 'Idadi',
  },
  'Distribution': {
    am: 'ስርጭት', om: 'Raabsa', ti: 'ምክፍፋል', so: 'Qaybin', ar: 'التوزيع', sw: 'Mgawanyo',
  },
  '{{title}} status counts': {
    am: 'የ{{title}} ሁኔታ ብዛቶች', om: 'Lakkoofsa haala {{title}}', ti: 'ቁጽርታት ኩነታት {{title}}', so: 'Tirada xaaladaha {{title}}', ar: 'أعداد حالات {{title}}', sw: 'Idadi za hali ya {{title}}',
  },
  '{{status}}: {{count}}': {
    am: '{{status}}፦ {{count}}', om: '{{status}}: {{count}}', ti: '{{status}}፦ {{count}}', so: '{{status}}: {{count}}', ar: '{{status}}: {{count}}', sw: '{{status}}: {{count}}',
  },
  'Choose the services your organization needs': {
    am: 'ድርጅትዎ የሚፈልጋቸውን አገልግሎቶች ይምረጡ', om: 'Tajaajiloota dhaabbanni keessan barbaadu filadhaa', ti: 'ትካልኩም ዘድልዮ ኣገልግሎታት ምረጹ', so: 'Dooro adeegyada ururkaagu u baahan yahay', ar: 'اختر الخدمات التي تحتاجها مؤسستك', sw: 'Chagua huduma ambazo shirika lako linahitaji',
  },
  'Service subscriptions': {
    am: 'የአገልግሎት ምዝገባዎች', om: 'Galmee tajaajilaa', ti: 'ምዝገባ ኣገልግሎት', so: 'Rukumashada adeegyada', ar: 'اشتراكات الخدمات', sw: 'Usajili wa huduma',
  },
  'Finance payment review': {
    am: 'የፋይናንስ ክፍያ ግምገማ', om: 'Gamaaggama kaffaltii faayinaansii', ti: 'ግምገማ ክፍሊት ፋይናንስ', so: 'Dib-u-eegista lacag-bixinta Maaliyadda', ar: 'مراجعة المدفوعات المالية', sw: 'Mapitio ya malipo ya Fedha',
  },
  'The Finance review queue could not be loaded. Refresh to try again.': {
    am: 'የፋይናንስ ግምገማ ዝርዝር መጫን አልተቻለም። እንደገና ያድሱ።', om: 'Tarreen gamaaggama faayinaansii fe’amuu hin dandeenye. Irra deebi’anii haaromsaa.', ti: 'ዝርዝር ግምገማ ፋይናንስ ምጽዓን ኣይተኻእለን። እንደገና ኣሐድሱ።', so: 'Lama soo rari karo safka dib-u-eegista Maaliyadda. Cusboonaysii si aad mar kale isugu daydo.', ar: 'تعذر تحميل قائمة مراجعة المدفوعات. حدّث الصفحة للمحاولة مجددًا.', sw: 'Imeshindikana kupakia foleni ya mapitio ya malipo. Onyesha upya ujaribu tena.',
  },
  'Loading payment review requests…': {
    am: 'የክፍያ ግምገማ ጥያቄዎችን በመጫን ላይ…', om: 'Gaaffiiwwan gamaaggama kaffaltii fe’aa jira…', ti: 'ሕቶታት ግምገማ ክፍሊት ይጽዕን ኣሎ…', so: 'Waxaa la rarayaa codsiyada dib-u-eegista lacag-bixinta…', ar: 'جارٍ تحميل طلبات مراجعة المدفوعات…', sw: 'Inapakia maombi ya mapitio ya malipo…',
  },
  '{{count}} subscription payment(s) require review.': {
    am: '{{count}} የምዝገባ ክፍያ(ዎች) ግምገማ ይፈልጋሉ።', om: 'Kaffaltiin galmee {{count}} gamaaggama barbaada.', ti: '{{count}} ክፍሊት ምዝገባ ግምገማ የድሊ።', so: '{{count}} lacag-bixin rukumasho ayaa u baahan dib-u-eegis.', ar: 'تحتاج {{count}} مدفوعات اشتراك إلى المراجعة.', sw: 'Malipo {{count}} ya usajili yanahitaji mapitio.',
  },
  'No subscription payments are awaiting review.': {
    am: 'ግምገማ የሚጠብቅ የምዝገባ ክፍያ የለም።', om: 'Kaffaltiin galmee gamaaggama eeggatu hin jiru.', ti: 'ግምገማ ዝጽበ ክፍሊት ምዝገባ የለን።', so: 'Ma jiraan lacag-bixinno rukumasho oo sugaya dib-u-eegis.', ar: 'لا توجد مدفوعات اشتراك بانتظار المراجعة.', sw: 'Hakuna malipo ya usajili yanayosubiri mapitio.',
  },
  'Refresh payment review': {
    am: 'የክፍያ ግምገማን አድስ', om: 'Gamaaggama kaffaltii haaromsi', ti: 'ግምገማ ክፍሊት ኣሐድስ', so: 'Cusboonaysii dib-u-eegista lacag-bixinta', ar: 'تحديث مراجعة المدفوعات', sw: 'Onyesha upya mapitio ya malipo',
  },
  'Confirm payment': {
    am: 'ክፍያን አረጋግጥ', om: 'Kaffaltii mirkaneessi', ti: 'ክፍሊት ኣረጋግጽ', so: 'Xaqiiji lacag-bixinta', ar: 'تأكيد الدفع', sw: 'Thibitisha malipo',
  },
  'Reject payment': {
    am: 'ክፍያን ውድቅ አድርግ', om: 'Kaffaltii didi', ti: 'ክፍሊት ነጽግ', so: 'Diid lacag-bixinta', ar: 'رفض الدفع', sw: 'Kataa malipo',
  },
  'Enter the payment confirmation reason (minimum 10 characters).': {
    am: 'የክፍያ ማረጋገጫ ምክንያትን ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sababa mirkaneessa kaffaltii galchaa (qubee yoo xiqqaate 10).', ti: 'ምኽንያት ምርግጋጽ ክፍሊት ኣእትዉ (ብውሑዱ 10 ፊደላት).', so: 'Geli sababta xaqiijinta lacag-bixinta (ugu yaraan 10 xaraf).', ar: 'أدخل سبب تأكيد الدفع (10 أحرف على الأقل).', sw: 'Weka sababu ya kuthibitisha malipo (angalau herufi 10).',
  },
  'Enter the rejection reason (minimum 10 characters).': {
    am: 'የውድቅ ምክንያትን ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sababa diduu galchaa (qubee yoo xiqqaate 10).', ti: 'ምኽንያት ምንጻግ ኣእትዉ (ብውሑዱ 10 ፊደላት).', so: 'Geli sababta diidmada (ugu yaraan 10 xaraf).', ar: 'أدخل سبب الرفض (10 أحرف على الأقل).', sw: 'Weka sababu ya kukataa (angalau herufi 10).',
  },
  'Payment confirmed. Service activation will begin after Accounting records the transaction.': {
    am: 'ክፍያው ተረጋግጧል። ሂሳብ ክፍያውን ከመዘገበ በኋላ አገልግሎቱ ይነቃል።', om: 'Kaffaltiin mirkanaa’eera. Herregni erga galmeessee booda tajaajilli ni banama.', ti: 'ክፍሊት ተረጋጊጹ። ሒሳብ ነቲ ግብይት ምስ መዝገቦ ኣገልግሎት ክንቀሳቐስ እዩ።', so: 'Lacag-bixinta waa la xaqiijiyey. Adeeggu wuxuu hawlgelayaa ka dib marka Xisaabtu diiwaangeliso macaamilka.', ar: 'تم تأكيد الدفع. سيبدأ تفعيل الخدمة بعد تسجيل المعاملة في المحاسبة.', sw: 'Malipo yamethibitishwa. Huduma itaanza baada ya Uhasibu kurekodi muamala.',
  },
  'Payment reference': {
    am: 'የክፍያ ማጣቀሻ', om: 'Wabii kaffaltii', ti: 'መወከሲ ክፍሊት', so: 'Tixraaca lacag-bixinta', ar: 'مرجع الدفع', sw: 'Rejea ya malipo',
  },
  'Submit payment reference': {
    am: 'የክፍያ ማጣቀሻ አስገባ', om: 'Wabii kaffaltii galchi', ti: 'መወከሲ ክፍሊት ኣቕርብ', so: 'Gudbi tixraaca lacag-bixinta', ar: 'إرسال مرجع الدفع', sw: 'Wasilisha rejea ya malipo',
  },
  'Payment reference: {{reference}}': {
    am: 'የክፍያ ማጣቀሻ፦ {{reference}}', om: 'Wabii kaffaltii: {{reference}}', ti: 'መወከሲ ክፍሊት፦ {{reference}}', so: 'Tixraaca lacag-bixinta: {{reference}}', ar: 'مرجع الدفع: {{reference}}', sw: 'Rejea ya malipo: {{reference}}',
  },
  'Payment reference submitted for independent Finance review.': {
    am: 'የክፍያ ማጣቀሻው ለገለልተኛ የፋይናንስ ግምገማ ተልኳል።', om: 'Wabiin kaffaltii gamaaggama faayinaansii walabaa irratti ergameera.', ti: 'መወከሲ ክፍሊት ንናጻ ግምገማ ፋይናንስ ተላኢኹ።', so: 'Tixraaca lacag-bixinta waxaa loo diray dib-u-eegis Maaliyadeed oo madax-bannaan.', ar: 'أُرسل مرجع الدفع لمراجعة مالية مستقلة.', sw: 'Rejea ya malipo imetumwa kwa mapitio huru ya Fedha.',
  },
  'The subscription request is missing its identifier.': {
    am: 'የምዝገባ ጥያቄው መለያ ቁጥር የለውም።', om: 'Gaaffiin galmee kun eenyummaa hin qabu.', ti: 'እቲ ሕቶ ምዝገባ መለለዪ የብሉን።', so: 'Codsiga rukumashadu ma laha aqoonsi.', ar: 'طلب الاشتراك يفتقد المعرّف.', sw: 'Ombi la usajili halina kitambulisho chake.',
  },
  'Subscription payment decision recorded.': {
    am: 'የምዝገባ ክፍያ ውሳኔ ተመዝግቧል።', om: 'Murtiin kaffaltii galmee galmaa’eera.', ti: 'ውሳነ ክፍሊት ምዝገባ ተመዝጊቡ።', so: 'Go’aanka lacag-bixinta rukumashada waa la diiwaangeliyey.', ar: 'تم تسجيل قرار دفع الاشتراك.', sw: 'Uamuzi wa malipo ya usajili umerekodiwa.',
  },
  'ETB 1,000 per month for each selected service': {
    am: 'ለእያንዳንዱ የተመረጠ አገልግሎት በወር ETB 1,000', om: 'Tajaajila filatame tokkoon tokkoon ji’atti ETB 1,000', ti: 'ንነፍሲ ወከፍ ዝተመርጸ ኣገልግሎት ኣብ ወርሒ ETB 1,000', so: 'ETB 1,000 bishii adeeg kasta oo la doorto', ar: '١٬٠٠٠ بر إثيوبي شهريًا لكل خدمة مختارة', sw: 'ETB 1,000 kwa mwezi kwa kila huduma iliyochaguliwa',
  },
  'Payment is manual. Finance confirms receipt before activation. A subscription request does not charge you or activate a service automatically.': {
    am: 'ክፍያ በእጅ ይፈጸማል። ፋይናንስ ክፍያውን ከማረጋገጡ በፊት አገልግሎት አይነቃም። የምዝገባ ጥያቄ ክፍያ አያስከፍልም ወይም አገልግሎትን በራስ-ሰር አያነቃም።',
    om: 'Kaffaltiin harkaan raawwatama. Faayinaansiin kaffaltii mirkaneessuu dura tajaajilli hin banamu. Gaaffiin tajaajilaa kaffaltii hin fudhatu yookaan tajaajila ofumaan hin banu.',
    ti: 'ክፍሊት ብኢድ ይፍጸም። ፋይናንስ ክፍሊት ቅድሚ ምርግጋጹ ኣገልግሎት ኣይንቀሳቐስን። ሕቶ ክፍሊት ኣይእክብን ኣገልግሎት ብርእሱ ኣይንቀሳቐስን።',
    so: 'Lacag-bixintu waa gacanta. Maaliyaddu waxay xaqiijinaysaa helitaanka ka hor hawlgelinta. Codsiga isdiiwaangelintu lacag kuguma dallacayo mana hawlgelinayo adeeg si toos ah.',
    ar: 'الدفع يدوي. تؤكد الشؤون المالية استلام المبلغ قبل التفعيل. طلب الاشتراك لا يفرض رسومًا ولا يفعّل الخدمة تلقائيًا.',
    sw: 'Malipo hufanywa kwa mikono. Fedha huthibitisha kupokea malipo kabla ya kuwezesha. Ombi la usajili halikutozi wala kuwezesha huduma moja kwa moja.',
  },
  'ETB 1,000 per month for this service': {
    am: 'ለዚህ አገልግሎት በወር ETB 1,000', om: 'Tajaajila kanaaf ji’atti ETB 1,000', ti: 'ንዚ ኣገልግሎት ኣብ ወርሒ ETB 1,000', so: 'ETB 1,000 bishii adeeggan', ar: '١٬٠٠٠ بر إثيوبي شهريًا لهذه الخدمة', sw: 'ETB 1,000 kwa mwezi kwa huduma hii',
  },
  'Estimated monthly total: ETB {{amount}}': {
    am: 'ግምታዊ ወርሃዊ ድምር፦ ETB {{amount}}', om: 'Waliigala ji’aa tilmaamame: ETB {{amount}}', ti: 'ግምታዊ ጠቕላላ ወርሒ፦ ETB {{amount}}', so: 'Wadarta bisha la qiyaasay: ETB {{amount}}', ar: 'الإجمالي الشهري التقديري: {{amount}} بر إثيوبي', sw: 'Jumla ya makadirio ya mwezi: ETB {{amount}}',
  },
  'Request selected services': {
    am: 'የተመረጡ አገልግሎቶችን ይጠይቁ', om: 'Tajaajiloota filataman gaafadhaa', ti: 'ዝተመርጹ ኣገልግሎታት ሕተቱ', so: 'Codso adeegyada la doortay', ar: 'اطلب الخدمات المحددة', sw: 'Omba huduma ulizochagua',
  },
  'Sign in to request selected services': {
    am: 'የተመረጡ አገልግሎቶችን ለመጠየቅ ይግቡ', om: 'Tajaajiloota filataman gaafachuuf seenaa', ti: 'ዝተመርጹ ኣገልግሎታት ንምሕታት እቶ', so: 'Gal si aad u codsato adeegyada la doortay', ar: 'سجّل الدخول لطلب الخدمات المحددة', sw: 'Ingia ili kuomba huduma ulizochagua',
  },
  'Select at least one service to request.': {
    am: 'ለመጠየቅ ቢያንስ አንድ አገልግሎት ይምረጡ።', om: 'Gaafachuuf yoo xiqqaate tajaajila tokko filadhaa.', ti: 'ንምሕታት እንተወሓደ ሓደ ኣገልግሎት ምረጹ።', so: 'Dooro ugu yaraan hal adeeg si aad u codsato.', ar: 'اختر خدمة واحدة على الأقل لطلبها.', sw: 'Chagua angalau huduma moja ya kuomba.',
  },
  'Available subscriptions could not be loaded. Try again when the connection is available.': {
    am: 'የሚገኙ ምዝገባዎችን መጫን አልተቻለም። ግንኙነቱ ሲኖር እንደገና ይሞክሩ።', om: 'Galmee tajaajilaa fe’uun hin danda’amne. Walqunnamtiin yeroo jiru irra deebi’anii yaalaa.', ti: 'ዝርከቡ ምዝገባታት ምጽዓን ኣይተኻእለን። ርክብ እንተሃልዩ እንደገና ፈትኑ።', so: 'Lama soo rari karo rukumashada la heli karo. Mar kale isku day marka xiriirku jiro.', ar: 'تعذر تحميل الاشتراكات المتاحة. حاول مجددًا عند توفر الاتصال.', sw: 'Imeshindikana kupakia usajili unaopatikana. Jaribu tena muunganisho ukiwa tayari.',
  },
  'Retry loading subscriptions': {
    am: 'ምዝገባዎችን እንደገና ጫን', om: 'Galmee irra deebi’anii fe’i', ti: 'ምዝገባታት እንደገና ጽዓን', so: 'Dib u rar rukumashada', ar: 'أعد تحميل الاشتراكات', sw: 'Pakia tena usajili',
  },
  'There are no public subscriptions available right now.': {
    am: 'በአሁኑ ጊዜ ለሕዝብ የሚቀርብ ምዝገባ የለም።', om: 'Yeroo ammaa galmeen uummataaf dhiyaatu hin jiru.', ti: 'ኣብዚ ግዜ ንህዝቢ ዝቐርብ ምዝገባ የለን።', so: 'Hadda ma jiraan rukumasho dadweyne oo la heli karo.', ar: 'لا توجد اشتراكات عامة متاحة حاليًا.', sw: 'Kwa sasa hakuna usajili wa umma unaopatikana.',
  },
  'Subscription request submitted. Payment is manual; Finance must confirm receipt before activation. No automatic charge was made.': {
    am: 'የምዝገባ ጥያቄው ተልኳል። ክፍያ በእጅ ይፈጸማል፤ ከማግበር በፊት ፋይናንስ መቀበሉን ማረጋገጥ አለበት። በራስ-ሰር ክፍያ አልተፈጸመም።',
    om: 'Gaaffiin galmee ergameera. Kaffaltiin harkaan; faayinaansiin hojii irra ooluu dura kaffaltii mirkaneessuu qaba. Kaffaltiin ofumaan hin raawwatamne.',
    ti: 'ሕቶ ምዝገባ ተላኢኹ። ክፍሊት ብኢድ እዩ፤ ፋይናንስ ቅድሚ ምንቃሕ ክቕበሎ ኣለዎ። ብርእሱ ክፍሊት ኣይተፈጸመን።',
    so: 'Codsiga rukumashada waa la diray. Lacag-bixintu waa gacanta; Maaliyaddu waa inay xaqiijisaa helitaanka ka hor hawlgelinta. Lacag si toos ah looma qaadin.',
    ar: 'تم إرسال طلب الاشتراك. الدفع يدوي؛ ويجب أن تؤكد الشؤون المالية الاستلام قبل التفعيل. لم يتم فرض أي رسوم تلقائية.',
    sw: 'Ombi la usajili limetumwa. Malipo ni ya mikono; Fedha lazima zithibitishe kupokea kabla ya kuwezesha. Hakuna malipo ya moja kwa moja yaliyofanywa.',
  },
  'Pending finance confirmation': {
    am: 'የፋይናንስ ማረጋገጫ በመጠባበቅ ላይ', om: 'Mirkaneessa faayinaansii eegaa jira', ti: 'ምርግጋጽ ፋይናንስ ይጽበ ኣሎ', so: 'Sugaya xaqiijinta maaliyadda', ar: 'بانتظار تأكيد الشؤون المالية', sw: 'Inasubiri uthibitisho wa Fedha',
  },
  'Your subscription requests could not be loaded. Select Refresh to try again.': {
    am: 'የምዝገባ ጥያቄዎችዎን መጫን አልተቻለም። እንደገና ለመሞከር አድስን ይምረጡ።', om: 'Gaaffiiwwan galmee keessanii fe’uun hin danda’amne. Irra deebi’uuf Haaromsi filadhaa.', ti: 'ሕቶታት ምዝገባኹም ምጽዓን ኣይተኻእለን። ንምፍታን ኣሐድስ ምረጹ።', so: 'Lama soo rari karo codsiyada rukumashadaada. Dooro Cusboonaysii si aad mar kale isugu daydo.', ar: 'تعذر تحميل طلبات اشتراكك. اختر تحديث للمحاولة مجددًا.', sw: 'Imeshindikana kupakia maombi yako ya usajili. Chagua Onyesha upya ili ujaribu tena.',
  },
  'Your subscription requests': {
    am: 'የእርስዎ የምዝገባ ጥያቄዎች', om: 'Gaaffiiwwan galmee keessan', ti: 'ሕቶታት ምዝገባኹም', so: 'Codsiyadaada rukumashada', ar: 'طلبات اشتراكك', sw: 'Maombi yako ya usajili',
  },
  'No subscription requests yet.': {
    am: 'እስካሁን የምዝገባ ጥያቄ የለም።', om: 'Ammaaf gaaffiin galmee hin jiru.', ti: 'ክሳብ ሕጂ ሕቶ ምዝገባ የለን።', so: 'Weli ma jiraan codsiyo rukumasho.', ar: 'لا توجد طلبات اشتراك بعد.', sw: 'Bado hakuna maombi ya usajili.',
  },
  'Selected services': {
    am: 'የተመረጡ አገልግሎቶች', om: 'Tajaajiloota filataman', ti: 'ዝተመርጹ ኣገልግሎታት', so: 'Adeegyada la doortay', ar: 'الخدمات المحددة', sw: 'Huduma zilizochaguliwa',
  },
  '{{services}} — {{status}}': {
    am: '{{services}} — {{status}}', om: '{{services}} — {{status}}', ti: '{{services}} — {{status}}', so: '{{services}} — {{status}}', ar: '{{services}} — {{status}}', sw: '{{services}} — {{status}}',
  },
  '{{name}} · ETB {{amount}} · reference {{reference}}': {
    am: '{{name}} · ETB {{amount}} · ማጣቀሻ {{reference}}', om: '{{name}} · ETB {{amount}} · wabii {{reference}}', ti: '{{name}} · ETB {{amount}} · መወከሲ {{reference}}', so: '{{name}} · ETB {{amount}} · tixraac {{reference}}', ar: '{{name}} · {{amount}} بر إثيوبي · المرجع {{reference}}', sw: '{{name}} · ETB {{amount}} · rejea {{reference}}',
  },
  'Loading available subscriptions…': {
    am: 'የሚገኙ ምዝገባዎችን በመጫን ላይ…', om: 'Galmeewwan jiran fe’aa jira…', ti: 'ምዝገባታት ይጽዕን ኣሎ…', so: 'Waxaa la rarayaa rukumashooyinka la heli karo…', ar: 'جارٍ تحميل الاشتراكات المتاحة…', sw: 'Inapakia usajili unaopatikana…',
  },
  'Select the services you need': {
    am: 'የሚፈልጓቸውን አገልግሎቶች ይምረጡ', om: 'Tajaajiloota isin barbaaddan filadhaa', ti: 'ዘድልዩኹም ኣገልግሎታት ምረጹ', so: 'Dooro adeegyada aad u baahan tahay', ar: 'اختر الخدمات التي تحتاجها', sw: 'Chagua huduma unazohitaji',
  },
  'Submit Edir registration application': {
    am: 'የእድር ምዝገባ ማመልከቻ ያስገቡ', om: 'Iyyannoo galmee Edir ergaa', ti: 'መመልከቲ ምዝገባ Edir ኣቕርቡ', so: 'Gudbi codsiga diiwaangelinta Edir', ar: 'إرسال طلب تسجيل إدير', sw: 'Wasilisha ombi la usajili wa Edir',
  },
  'Retry Edir document uploads': {
    am: 'የእድር ሰነዶችን እንደገና ይላኩ', om: 'Sanadoota Edir irra deebi’anii ergaa', ti: 'ሰነዳት Edir እንደገና ስደዱ', so: 'Dib u dir dukumentiyada Edir', ar: 'أعد محاولة رفع وثائق إدير', sw: 'Jaribu tena kupakia nyaraka za Edir',
  },
  'All required documents uploaded': {
    am: 'ሁሉም የሚፈለጉ ሰነዶች ተጭነዋል', om: 'Sanadoonni barbaachisan hundi fe’amaniiru', ti: 'ኩሎም ዝድለዩ ሰነዳት ተጸዒኖም', so: 'Dhammaan dukumentiyada loo baahan yahay waa la raray', ar: 'تم رفع جميع الوثائق المطلوبة', sw: 'Nyaraka zote zinazohitajika zimepakiwa',
  },
  'Application {{id}} is saved. {{uploaded}} of {{total}} required documents uploaded. Select the remaining document files and retry: {{documents}}.': {
    am: 'ማመልከቻ {{id}} ተቀምጧል። ከ{{total}} የሚፈለጉ ሰነዶች {{uploaded}} ተጭነዋል። የቀሩትን ይምረጡና እንደገና ይሞክሩ፦ {{documents}}።',
    om: 'Iyyannoon {{id}} olkaa’ameera. Sanadoota barbaachisan {{total}} keessaa {{uploaded}} fe’amaniiru. Sanada hafe filadhaa, irra deebi’a: {{documents}}.',
    ti: 'መመልከቲ {{id}} ተዓቂቡ። ካብ {{total}} ዝድለዩ ሰነዳት {{uploaded}} ተጸዒኖም። ዝተረፉ ሰነዳት ምረጹን እንደገና ፈትኑን፦ {{documents}}።',
    so: 'Codsiga {{id}} waa la kaydiyey. {{uploaded}} ka mid ah {{total}} dukumenti ayaa la raray. Dooro faylasha hadhay oo mar kale isku day: {{documents}}.',
    ar: 'تم حفظ الطلب {{id}}. رُفع {{uploaded}} من أصل {{total}} من الوثائق المطلوبة. اختر الملفات المتبقية وأعد المحاولة: {{documents}}.',
    sw: 'Ombi {{id}} limehifadhiwa. Nyaraka {{uploaded}} kati ya {{total}} zinazohitajika zimepakiwa. Chagua faili zilizobaki na ujaribu tena: {{documents}}.',
  },
  'Application {{id}} was saved; {{uploaded}} of {{total}} required documents uploaded. {{error}} Select the remaining file and retry. Your form details and unuploaded file selections are still here.': {
    am: 'ማመልከቻ {{id}} ተቀምጧል፤ ከ{{total}} የሚፈለጉ ሰነዶች {{uploaded}} ተጭነዋል። {{error}} የቀረውን ፋይል ይምረጡና እንደገና ይሞክሩ። የቅጹ ዝርዝሮችና ያልተላኩ ፋይሎች አሁንም እዚህ አሉ።',
    om: 'Iyyannoon {{id}} olkaa’ameera; sanadoota {{total}} keessaa {{uploaded}} fe’amaniiru. {{error}} Faayila hafe filadhaa irra deebi’aa. Odeeffannoon unka keessanii fi faayiloonni hin ergamne asuma jiru.',
    ti: 'መመልከቲ {{id}} ተዓቂቡ፤ ካብ {{total}} ዝድለዩ ሰነዳት {{uploaded}} ተጸዒኖም። {{error}} ዝተረፈ ፋይል ምረጹን እንደገና ፈትኑን። ዝርዝራት ቅጺኹምን ዘይተላእኩ ፋይላትን ኣብዚ ኣለዉ።',
    so: 'Codsiga {{id}} waa la kaydiyey; {{uploaded}} ka mid ah {{total}} dukumenti ayaa la raray. {{error}} Dooro faylka hadhay oo mar kale isku day. Faahfaahinta foomka iyo faylasha aan la dirin way kuu yaallaan.',
    ar: 'تم حفظ الطلب {{id}}؛ رُفع {{uploaded}} من أصل {{total}} من الوثائق المطلوبة. {{error}} اختر الملف المتبقي وأعد المحاولة. ما زالت تفاصيل النموذج والملفات غير المرفوعة محفوظة هنا.',
    sw: 'Ombi {{id}} limehifadhiwa; nyaraka {{uploaded}} kati ya {{total}} zimepakiwa. {{error}} Chagua faili iliyobaki na ujaribu tena. Maelezo ya fomu na faili ambazo hazijapakiwa bado zipo hapa.',
  },
  'Select the required {{document}} file.': {
    am: 'የሚፈለገውን {{document}} ፋይል ይምረጡ።', om: 'Faayila {{document}} barbaachisu filadhaa.', ti: 'ዝድለ ፋይል {{document}} ምረጹ።', so: 'Dooro faylka {{document}} ee loo baahan yahay.', ar: 'اختر ملف {{document}} المطلوب.', sw: 'Chagua faili ya {{document}} inayohitajika.',
  },
  'The application response did not include the secure upload details. Contact AfroLife support before submitting again.': {
    am: 'የማመልከቻው ምላሽ ደህንነቱ የተጠበቀ የመጫኛ መረጃ አልያዘም። እንደገና ከማስገባትዎ በፊት የAfroLife ድጋፍን ያነጋግሩ።',
    om: 'Deebiin iyyannoo odeeffannoo fe’iinsa nageenya qabu hin qabne. Irra deebi’anii erguu dura deeggarsa AfroLife qunnamaa.',
    ti: 'መልሲ መመልከቲ ውሑስ ሓበሬታ ምጽዓን ኣይሓዘን። እንደገና ቅድሚ ምቕራብ ደገፍ AfroLife ርኸቡ።',
    so: 'Jawaabta codsigu kuma jirin faahfaahinta rarista ammaan ah. La xiriir taageerada AfroLife ka hor intaadan mar kale gudbin.',
    ar: 'لم يتضمن رد الطلب تفاصيل الرفع الآمن. اتصل بدعم AfroLife قبل إعادة الإرسال.',
    sw: 'Jibu la ombi halikuwa na maelezo ya upakiaji salama. Wasiliana na usaidizi wa AfroLife kabla ya kutuma tena.',
  },
  'Replacement document uploaded securely for compliance review.': {
    am: 'የምትክ ሰነዱ ለተገዢነት ግምገማ በደህንነት ተጭኗል።', om: 'Sanadni bakka bu’aa gamaaggamaaf nageenyaan fe’ameera.', ti: 'ምትክ ሰነድ ንግምገማ ብውሑስነት ተጸዒኑ።', so: 'Dukumentiga beddelka ah si ammaan ah ayaa loogu raray dib-u-eegista.', ar: 'تم رفع الوثيقة البديلة بأمان للمراجعة.', sw: 'Hati mbadala imepakiwa kwa usalama kwa ukaguzi.',
  },
  'One trusted place to get work moving.': {
    am: 'ሥራን ለማስኬድ አንድ የታመነ ቦታ።', om: 'Bakka amanamaa hojii itti jalqabsiisan.', ti: 'ስራሕ ንምንቅስቓስ ሓደ ዝተኣመነ ቦታ።', so: 'Hal meel lagu kalsoon yahay oo shaqada dhaqaajisa.', ar: 'مكان موثوق واحد لدفع العمل قدمًا.', sw: 'Sehemu moja ya kuaminika ya kuendeleza kazi.',
  },
  'Coordinate leads, verified workers and service requests with clear ownership at every step.': {
    am: 'ደንበኞችን፣ የተረጋገጡ ሠራተኞችንና የአገልግሎት ጥያቄዎችን በግልጽ ኃላፊነት ያስተባብሩ።', om: 'Maamiltoota, hojjettoota mirkanaa’an fi gaaffii tajaajilaa itti gaafatamummaa ifa ta’een qindeessaa.', ti: 'መራሕቲ፣ ዝተረጋገጹ ሰራሕተኛታትን ሕቶታት ኣገልግሎትን ብግልጺ ሓላፍነት ኣወሃህዱ።', so: 'Isku dubbarid fursadaha, shaqaalaha la xaqiijiyey iyo codsiyada adeegga adigoo mas’uuliyad cad leh.', ar: 'نسّق الفرص والعاملين المتحقق منهم وطلبات الخدمة مع وضوح المسؤولية في كل خطوة.', sw: 'Ratibu fursa, wafanyakazi waliothibitishwa na maombi ya huduma kwa uwajibikaji ulio wazi.',
  },
  'Verified workforce': {
    am: 'የተረጋገጠ የሠራተኛ ኃይል', om: 'Hojjettoota mirkanaa’an', ti: 'ዝተረጋገጸ ሓይሊ ሰራሕተኛ', so: 'Shaqaale la xaqiijiyey', ar: 'قوى عاملة تم التحقق منها', sw: 'Wafanyakazi waliothibitishwa',
  },
  'Accountable agent network': {
    am: 'ተጠያቂነት ያለው የወኪሎች መረብ', om: 'Neetworkii bakka bu’oota itti gaafatamummaa qabu', ti: 'ተሓታትነት ዘለዎ መርበብ ወከልቲ', so: 'Shabakad wakiillo lala xisaabtami karo', ar: 'شبكة وكلاء خاضعة للمساءلة', sw: 'Mtandao wa mawakala wenye uwajibikaji',
  },
  'Central matching oversight': {
    am: 'ማዕከላዊ የማዛመድ ቁጥጥር', om: 'To’annoo walitti fiduu giddugaleessaa', ti: 'ማእከላዊ ቁጽጽር ምዝማድ', so: 'Kormeerka dhexe ee iswaafajinta', ar: 'إشراف مركزي على المطابقة', sw: 'Uangalizi mkuu wa ulinganishaji',
  },
  'SECURE WORKSPACE': {
    am: 'ደህንነቱ የተጠበቀ የሥራ ቦታ', om: 'Iddoo hojii nageenya qabu', ti: 'ውሑስ ቦታ ስራሕ', so: 'GOOB SHAQO OO AMMAAN AH', ar: 'مساحة عمل آمنة', sw: 'NAFASI SALAMA YA KAZI',
  },
  'Welcome back': {
    am: 'እንኳን ደህና መጡ', om: 'Baga nagaan deebiitan', ti: 'እንቋዕ ብደሓን ተመለስኩም', so: 'Ku soo dhawoow', ar: 'مرحبًا بعودتك', sw: 'Karibu tena',
  },
  'Sign in with your registered Ethiopian phone number.': {
    am: 'በተመዘገበው የኢትዮጵያ ስልክ ቁጥርዎ ይግቡ።', om: 'Lakkoofsa bilbilaa Itoophiyaa galmeessitan fayyadamuun seenaa.', ti: 'ብዝተመዝገበ ቁጽሪ ስልኪ ኢትዮጵያ እቶ።', so: 'Ku gal lambarka taleefanka Itoobiya ee aad ku diiwaangashan tahay.', ar: 'سجّل الدخول برقم هاتفك الإثيوبي المسجل.', sw: 'Ingia ukitumia nambari yako ya simu ya Ethiopia iliyosajiliwa.',
  },
  'Agent subscription plans': {
    am: 'የወኪል ምዝገባ ዕቅዶች', om: 'Karoorawwan galmee bakka bu’aa', ti: 'መደባት ምዝገባ ወኪል', so: 'Qorshayaasha rukumashada wakiilka', ar: 'خطط اشتراك الوكلاء', sw: 'Mipango ya usajili wa wakala',
  },
  'Apply to join AfroLife': {
    am: 'ወደ AfroLife ለመቀላቀል ያመልክቱ', om: 'AfroLife waliin makamuuf iyyadhaa', ti: 'ምስ AfroLife ንምጽንባር ኣመልክቱ', so: 'Codso inaad ku biirto AfroLife', ar: 'قدّم طلبًا للانضمام إلى AfroLife', sw: 'Omba kujiunga na AfroLife',
  },
  'Request community membership after KYC. Available membership products and terms are shown in the Edir workspace.': {
    am: 'ከKYC በኋላ የማህበረሰብ አባልነት ይጠይቁ። ያሉ የአባልነት ምርቶችና ውሎች በእድር የሥራ ቦታ ይታያሉ።', om: 'KYC booda miseensummaa hawaasaa gaafadhaa. Oomishaa fi ulaagaaleen Edir keessatti mul’atu.', ti: 'ድሕሪ KYC ኣባልነት ማሕበረሰብ ሕተቱ። ዘለዉ ፍርያትን ውዕላትን ኣብ ቦታ Edir ይርከቡ።', so: 'Codso xubinnimada bulshada kadib KYC. Adeegyada iyo shuruudaha xubinnimada waxaa lagu muujiyaa goobta Edir.', ar: 'اطلب عضوية المجتمع بعد KYC. تظهر منتجات العضوية وشروطها المتاحة في مساحة عمل إدير.', sw: 'Omba uanachama wa jamii baada ya KYC. Bidhaa na masharti ya uanachama yanaonyeshwa kwenye nafasi ya Edir.',
  },
  'ETHIOLIFE SUPER APP': {
    am: 'ETHIOLIFE ሱፐር አፕ', om: 'APPII SUPER ETHIOLIFE', ti: 'SUPER APP ETHIOLIFE', so: 'BARNAAMIJKA WEYN EE ETHIOLIFE', ar: 'تطبيق ETHIOLIFE الشامل', sw: 'SUPER APP YA ETHIOLIFE',
  },
  'Services for work, homes, business, and community.': {
    am: 'ለሥራ፣ ለቤት፣ ለንግድና ለማህበረሰብ አገልግሎቶች።', om: 'Tajaajiloota hojii, mana, daldalaa fi hawaasaaf.', ti: 'ኣገልግሎታት ስራሕ፣ ገዛ፣ ንግዲን ማሕበረሰብን።', so: 'Adeegyada shaqada, guryaha, ganacsiga iyo bulshada.', ar: 'خدمات للعمل والمنازل والأعمال والمجتمع.', sw: 'Huduma za kazi, nyumba, biashara na jamii.',
  },
  'Explore AfroLife’s connected services. Install the app for a home-screen shortcut and a cached public shell; sign in to access account-specific tools.': {
    am: 'የAfroLife ተያያዥ አገልግሎቶችን ይመልከቱ። ለመነሻ ማያ አቋራጭና ለተቀመጠ የሕዝብ ገጽ መተግበሪያውን ይጫኑ፤ የመለያዎን መሣሪያዎች ለመጠቀም ይግቡ።',
    om: 'Tajaajiloota walitti hidhaman AfroLife ilaalaa. Mallattoo fuula jalqabaa fi fuula uummataa kuufameef appii fe’aa; meeshaalee herrega keessaniif seenaa.',
    ti: 'ኣገልግሎታት AfroLife ርኣዩ። ንመልክዕ መነሻን ዝተኻዘነ ገጽ ህዝብን መተግበሪ ጽዓኑ፤ ናይ ሕሳብ መሳርሒታት ንምጥቃም እቶ።',
    so: 'Baadh adeegyada AfroLife ee isku xiran. Ku rakib app-ka si aad u hesho astaan shaashadda hore iyo bog dadweyne oo kaydsan; gal si aad u hesho qalabka akoonkaaga.',
    ar: 'استكشف خدمات AfroLife المترابطة. ثبّت التطبيق لاختصار الشاشة الرئيسية والواجهة العامة المحفوظة؛ سجّل الدخول للوصول إلى أدوات حسابك.',
    sw: 'Chunguza huduma zilizounganishwa za AfroLife. Sakinisha programu kwa njia ya mkato ya skrini ya nyumbani na ukurasa wa umma uliohifadhiwa; ingia ili kufikia zana za akaunti yako.',
  },
  'SERVICE MENU': {
    am: 'የአገልግሎት ምናሌ', om: 'TARREE TAJAAJILAA', ti: 'ምናሌ ኣገልግሎት', so: 'LIISKA ADEEGYADA', ar: 'قائمة الخدمات', sw: 'MENYU YA HUDUMA',
  },
  'One app, useful services': {
    am: 'አንድ መተግበሪያ፣ ጠቃሚ አገልግሎቶች', om: 'Appii tokko, tajaajiloota faayidaa qaban', ti: 'ሓደ መተግበሪ፣ ጠቓሚ ኣገልግሎታት', so: 'Hal app, adeegyo waxtar leh', ar: 'تطبيق واحد وخدمات مفيدة', sw: 'Programu moja, huduma zenye manufaa',
  },
  'Choose a service to continue': {
    am: 'ለመቀጠል አገልግሎት ይምረጡ', om: 'Itti fufuuf tajaajila filadhaa', ti: 'ንምቕጻል ኣገልግሎት ምረጹ', so: 'Dooro adeeg si aad u sii wadato', ar: 'اختر خدمة للمتابعة', sw: 'Chagua huduma ili kuendelea',
  },
  'Homes & rentals': {
    am: 'ቤቶችና ኪራዮች', om: 'Manneen fi kiraa', ti: 'ገዛውቲን ክራይን', so: 'Guryaha iyo kirada', ar: 'المنازل والإيجارات', sw: 'Nyumba na upangishaji',
  },
  'Browse property listings, connect landlords and tenants, and manage rent workflows where enabled.': {
    am: 'የንብረት ዝርዝሮችን ይመልከቱ፣ አከራዮችንና ተከራዮችን ያገናኙ፣ ከነቃም የኪራይ ሥራዎችን ያስተዳድሩ።', om: 'Tarree qabeenyaa ilaalaa, abbootii manaa fi kireeffattoota wal qunnamsiisaa, hojii kiraa bulchaa.', ti: 'ዝርዝራት ንብረት ርኣዩ፣ ኣካረይትን ተኻረይትን ኣራኽቡ፣ ስራሕ ክራይ ኣመሓድሩ።', so: 'Eeg liisaska hantida, isku xir milkiilayaasha iyo kiraystayaasha, maamulna shaqada kirada marka la hawlgeliyo.', ar: 'تصفّح قوائم العقارات، واربط المُلّاك بالمستأجرين، وأدر إجراءات الإيجار عند تفعيلها.', sw: 'Vinjari matangazo ya mali, unganisha wamiliki na wapangaji, na usimamie kodi inapowezeshwa.',
  },
  'Marketplace': {
    am: 'የገበያ ቦታ', om: 'Gabaa', ti: 'ዕዳጋ', so: 'Suuqa', ar: 'السوق', sw: 'Soko',
  },
  'Discover products and services from registered sellers and local businesses.': {
    am: 'ከተመዘገቡ ሻጮችና አካባቢያዊ ንግዶች ምርቶችንና አገልግሎቶችን ያግኙ።', om: 'Oomishaalee fi tajaajiloota gurgurtoota galmaa’anii fi daldala naannoo irraa argadhaa.', ti: 'ካብ ዝተመዝገቡ ሻየጥን ናይ ከባቢ ንግድን ፍርያትን ኣገልግሎታትን ርኸቡ።', so: 'Ka hel badeecooyin iyo adeegyo iibiyeyaasha diiwaangashan iyo ganacsiyada deegaanka.', ar: 'اكتشف المنتجات والخدمات من البائعين المسجلين والشركات المحلية.', sw: 'Gundua bidhaa na huduma kutoka kwa wauzaji waliosajiliwa na biashara za eneo lako.',
  },
  'Workforce': {
    am: 'የሠራተኛ ኃይል', om: 'Hojjettoota', ti: 'ሓይሊ ሰራሕተኛ', so: 'Shaqaalaha', ar: 'القوى العاملة', sw: 'Wafanyakazi',
  },
  'Find work opportunities, verified worker profiles, and employer service requests.': {
    am: 'የሥራ ዕድሎችን፣ የተረጋገጡ የሠራተኛ መገለጫዎችንና የአሠሪ ጥያቄዎችን ያግኙ።', om: 'Carraa hojii, piroofaayila hojjettootaa mirkanaa’an fi gaaffii hojii kennitootaa argadhaa.', ti: 'ዕድላት ስራሕ፣ ዝተረጋገጹ መግለጺታት ሰራሕተኛን ሕቶታት ኣስራሕቲን ርኸቡ።', so: 'Hel fursadaha shaqada, xogta shaqaalaha la xaqiijiyey iyo codsiyada loo-shaqeeyaha.', ar: 'اعثر على فرص العمل وملفات العاملين المتحقق منهم وطلبات أصحاب العمل.', sw: 'Pata fursa za kazi, wasifu wa wafanyakazi waliothibitishwa na maombi ya waajiri.',
  },
  'AfroLife Edir': {
    am: 'AfroLife እድር', om: 'Edir AfroLife', ti: 'Edir AfroLife', so: 'AfroLife Edir', ar: 'إدير AfroLife', sw: 'AfroLife Edir',
  },
  'SACCO / MFI': {
    am: 'ህብረት ሥራ ቁጠባ / ፋይናንስ ተቋም', om: 'SACCO / MFI', ti: 'SACCO / MFI', so: 'SACCO / MFI', ar: 'تعاونية ادخار وائتمان / مؤسسة تمويل أصغر', sw: 'SACCO / MFI',
  },
  'Business entities': {
    am: 'የንግድ ድርጅቶች', om: 'Dhaabbilee daldalaa', ti: 'ትካላት ንግዲ', so: 'Hay’adaha ganacsiga', ar: 'الكيانات التجارية', sw: 'Mashirika ya biashara',
  },
  'Select an entity book. Parent access only exposes consolidated totals unless you also have accounting access to child books.': {
    am: 'የድርጅት መዝገብ ይምረጡ። የወላጅ ድርጅት መዳረሻ የተጠቃለሉ ድምሮችን ብቻ ያሳያል፤ የልጅ ድርጅቶች መዳረሻ ካለዎት በስተቀር።', om: 'Galmee dhaabbataa filadhaa. Hayyamni dhaabbata abbaa waliigala walitti qabame qofa agarsiisa; yoo galmee dhaabbata ijoollee argachuuf hayyama qabaattan malee.', ti: 'መዝገብ ትካል ምረጹ። መእተዊ ወላዲ ጠቕላላ ድምር ጥራይ የርኢ፤ ናብ መዝገብ ትካላት ውሉድ መእተዊ እንተሃልዩኩም ግን ኣይኮነን።', so: 'Dooro buugga hay’adda. Helitaanka hay’adda waalidku wuxuu muujinayaa wadarta la isku geeyey oo keliya ilaa aad sidoo kale u leedahay helitaanka buugaagta hay’adaha hoose.', ar: 'اختر دفتر الكيان. وصول الكيان الرئيسي يعرض الإجماليات المجمعة فقط ما لم يكن لديك وصول محاسبي إلى دفاتر الكيانات التابعة.', sw: 'Chagua kitabu cha taasisi. Ufikiaji wa taasisi mama huonyesha jumla zilizounganishwa tu isipokuwa pia uwe na ufikiaji wa vitabu vya taasisi ndogo.',
  },
  'Entity or business name': {
    am: 'የድርጅት ወይም የንግድ ስም', om: 'Maqaa dhaabbataa ykn daldalaa', ti: 'ስም ትካል ወይ ንግዲ', so: 'Magaca hay’adda ama ganacsiga', ar: 'اسم الكيان أو النشاط التجاري', sw: 'Jina la taasisi au biashara',
  },
  'Entity type': {
    am: 'የድርጅት ዓይነት', om: 'Gosa dhaabbataa', ti: 'ዓይነት ትካል', so: 'Nooca hay’adda', ar: 'نوع الكيان', sw: 'Aina ya taasisi',
  },
  'Base currency': {
    am: 'መሠረታዊ ምንዛሬ', om: 'Maallaqa bu’uuraa', ti: 'መሰረታዊ ባጤራ', so: 'Lacagta aasaasiga ah', ar: 'العملة الأساسية', sw: 'Sarafu ya msingi',
  },
  'Create child entity': {
    am: 'ንዑስ ድርጅት ፍጠር', om: 'Dhaabbata damee uumaa', ti: 'ንኡስ ትካል ፍጠር', so: 'Samee hay’ad hoose', ar: 'إنشاء كيان تابع', sw: 'Unda taasisi tanzu',
  },
  'Assign entity access': {
    am: 'የድርጅት መዳረሻ መድብ', om: 'Hayyama dhaabbataa ramadi', ti: 'መእተዊ ትካል ምድባ', so: 'U qoondee gelitaanka hay’adda', ar: 'تعيين صلاحية الوصول إلى الكيان', sw: 'Weka ruhusa ya taasisi',
  },
  'AfroLife user UUID': {
    am: 'የAfroLife ተጠቃሚ UUID', om: 'UUID fayyadamaa AfroLife', ti: 'UUID ተጠቃሚ AfroLife', so: 'UUID-ga isticmaalaha AfroLife', ar: 'معرّف مستخدم AfroLife', sw: 'UUID ya mtumiaji wa AfroLife',
  },
  'Accounting role': {
    am: 'የሂሳብ ሚና', om: 'Gahee herregaa', ti: 'ሚና ሒሳብ', so: 'Doorka xisaabaadka', ar: 'الدور المحاسبي', sw: 'Jukumu la uhasibu',
  },
  'Create journal entry': {
    am: 'የጆርናል መዝገብ ፍጠር', om: 'Galmee gaazexaa uumaa', ti: 'መዝገብ ጆርናል ፍጠር', so: 'Samee gelin joornaal', ar: 'إنشاء قيد يومية', sw: 'Unda ingizo la jarida',
  },
  'Chart of accounts': {
    am: 'የሂሳብ መዝገብ ዝርዝር', om: 'Tarree herregaawwan', ti: 'ዝርዝር ሕሳባት', so: 'Jadwalka xisaabaadka', ar: 'دليل الحسابات', sw: 'Orodha ya akaunti',
  },
  'Journal register': {
    am: 'የጆርናል መዝገብ ማውጫ', om: 'Galmee gaazexaa', ti: 'መዝገብ ጆርናል', so: 'Diiwaanka joornaalka', ar: 'سجل القيود اليومية', sw: 'Rejesta ya majarida',
  },
  'Accounting periods': {
    am: 'የሂሳብ ጊዜያት', om: 'Yeroo herregaa', ti: 'እዋናት ሒሳብ', so: 'Xilliyada xisaabaadka', ar: 'الفترات المحاسبية', sw: 'Vipindi vya uhasibu',
  },
  'Entity reports': {
    am: 'የድርጅት ሪፖርቶች', om: 'Gabaasa dhaabbataa', ti: 'ጸብጻባት ትካል', so: 'Warbixinnada hay’adda', ar: 'تقارير الكيان', sw: 'Ripoti za taasisi',
  },
  'Unit rent (ETB, optional)': {
    am: 'የክፍል ኪራይ (ብር፣ አማራጭ)', om: 'Kiraa kutaa (ETB, filannoo)', ti: 'ክራይ ክፍሊ (ETB፣ ኣማራጺ)', so: 'Kirada qaybta (ETB, ikhtiyaari)', ar: 'إيجار الوحدة (ETB، اختياري)', sw: 'Kodi ya chumba (ETB, hiari)',
  },
  'Financial Services': {
    am: 'የፋይናንስ አገልግሎቶች', om: 'Tajaajila Faayinaansii', ti: 'ኣገልግሎታት ፋይናንስ', so: 'Adeegyada Maaliyadda', ar: 'الخدمات المالية', sw: 'Huduma za Fedha',
  },
  'Global BI': {
    am: 'ዓለም አቀፍ የንግድ ትንታኔ', om: 'Xiinxala Daldalaa Addunyaa', ti: 'ትንተና ንግዲ ዓለም', so: 'Falanqaynta Ganacsiga Caalamiga', ar: 'ذكاء الأعمال العالمي', sw: 'Uchanganuzi wa Biashara wa Kimataifa',
  },
  'Admin & review': {
    am: 'አስተዳደር እና ግምገማ', om: 'Bulchiinsa fi gamaaggama', ti: 'ምምሕዳርን ግምገማን', so: 'Maamul iyo dib-u-eegis', ar: 'الإدارة والمراجعة', sw: 'Usimamizi na ukaguzi',
  },
  'Service status': {
    am: 'የአገልግሎት ሁኔታ', om: 'Haala tajaajilaa', ti: 'ኩነታት ኣገልግሎት', so: 'Xaaladda adeegga', ar: 'حالة الخدمة', sw: 'Hali ya huduma',
  },
  'Workspace sections': {
    am: 'የሥራ ቦታ ክፍሎች', om: 'Kutaa iddoo hojii', ti: 'ክፍልታት ቦታ ስራሕ', so: 'Qaybaha goobta shaqada', ar: 'أقسام مساحة العمل', sw: 'Sehemu za nafasi ya kazi',
  },
  'All sections': {
    am: 'ሁሉም ክፍሎች', om: 'Kutaa hunda', ti: 'ኩሎም ክፍልታት', so: 'Dhammaan qaybaha', ar: 'كل الأقسام', sw: 'Sehemu zote',
  },
  'Your workspace': {
    am: 'የእርስዎ የሥራ ቦታ', om: 'Iddoo hojii keessan', ti: 'ቦታ ስራሕኩም', so: 'Goobtaada shaqada', ar: 'مساحة عملك', sw: 'Nafasi yako ya kazi',
  },
  'Refresh': {
    am: 'አድስ', om: 'Haaromsi', ti: 'ኣሐድስ', so: 'Cusboonaysii', ar: 'تحديث', sw: 'Onyesha upya',
  },
  'Your activity': {
    am: 'የእርስዎ እንቅስቃሴ', om: 'Sochii keessan', ti: 'ንጥፈታትኩም', so: 'Hawlahaaga', ar: 'نشاطك', sw: 'Shughuli zako',
  },
  'Your latest records and work in progress.': {
    am: 'የቅርብ ጊዜ መዝገቦችዎ እና በሂደት ላይ ያሉ ሥራዎች።', om: 'Galmeewwan dhiheenyaa fi hojii adeemsarra jiru.', ti: 'ናይ ቀረባ ግዜ መዝገባትኩምን ኣብ ምክያድ ዘሎ ስራሕን።', so: 'Diiwaannadaadii ugu dambeeyay iyo shaqada socota.', ar: 'أحدث سجلاتك والأعمال قيد التنفيذ.', sw: 'Rekodi zako za hivi karibuni na kazi zinazoendelea.',
  },
  'Overview': {
    am: 'አጠቃላይ እይታ', om: 'Cuunfaa', ti: 'ሓፈሻዊ ርእይቶ', so: 'Guudmar', ar: 'نظرة عامة', sw: 'Muhtasari',
  },
  'Leads': {
    am: 'ደንበኞች', om: 'Maamiltoota', ti: 'መራሕቲ', so: 'Macaamiisha', ar: 'العملاء المحتملون', sw: 'Wateja tarajiwa',
  },
  'Workers': {
    am: 'ሠራተኞች', om: 'Hojjettoota', ti: 'ሰራሕተኛታት', so: 'Shaqaalaha', ar: 'العاملون', sw: 'Wafanyakazi',
  },
  'Requests & matching': {
    am: 'ጥያቄዎች እና ማዛመድ', om: 'Gaaffii fi walitti fiduu', ti: 'ሕቶታትን ምዝማድን', so: 'Codsiyada iyo iswaafajinta', ar: 'الطلبات والمطابقة', sw: 'Maombi na ulinganishaji',
  },
  'Training & support': {
    am: 'ሥልጠና እና ድጋፍ', om: 'Leenjii fi deeggarsa', ti: 'ስልጠናን ደገፍን', so: 'Tababar iyo taageero', ar: 'التدريب والدعم', sw: 'Mafunzo na usaidizi',
  },
  'Properties': {
    am: 'ንብረቶች', om: 'Qabeenya', ti: 'ንብረታት', so: 'Hantida', ar: 'العقارات', sw: 'Mali',
  },
  'Contracts': {
    am: 'ውሎች', om: 'Waliigalteewwan', ti: 'ውዕላት', so: 'Heshiisyada', ar: 'العقود', sw: 'Mikataba',
  },
  'Commissions': {
    am: 'ኮሚሽኖች', om: 'Komishinii', ti: 'ኮሚሽናት', so: 'Guddiyada', ar: 'العمولات', sw: 'Kamisheni',
  },
  'Agent management': {
    am: 'የወኪል አስተዳደር', om: 'Bulchiinsa bakka bu’aa', ti: 'ምምሕዳር ወኪል', so: 'Maamulka wakiilka', ar: 'إدارة الوكلاء', sw: 'Usimamizi wa mawakala',
  },
  'Rent & deposits': {
    am: 'ኪራይ እና ተቀማጭ', om: 'Kiraa fi wabii', ti: 'ክራይን ተቐማጢን', so: 'Kirada iyo deebaajiga', ar: 'الإيجار والودائع', sw: 'Kodi na amana',
  },
  'AfroLife Edir': {
    am: 'AfroLife እድር', om: 'Edir AfroLife', ti: 'Edir AfroLife', so: 'AfroLife Edir', ar: 'إدير AfroLife', sw: 'AfroLife Edir',
  },
  'Privacy requests & incidents': {
    am: 'የግላዊነት ጥያቄዎች እና ክስተቶች', om: 'Gaaffii dhuunfaa fi taateewwan', ti: 'ሕቶታት ብሕታዊነትን ፍጻመታትን', so: 'Codsiyada gaarka ah iyo dhacdooyinka', ar: 'طلبات الخصوصية والحوادث', sw: 'Maombi ya faragha na matukio',
  },
  'Security': {
    am: 'ደህንነት', om: 'Nageenya', ti: 'ድሕነት', so: 'Amniga', ar: 'الأمان', sw: 'Usalama',
  },
  'SACCO / MFI workspace': {
    am: 'የSACCO / MFI የሥራ ቦታ', om: 'Iddoo hojii SACCO / MFI', ti: 'ቦታ ስራሕ SACCO / MFI', so: 'Goobta shaqada SACCO / MFI', ar: 'مساحة عمل SACCO / MFI', sw: 'Nafasi ya kazi ya SACCO / MFI',
  },
  'AfroLife Edir workspace': {
    am: 'የAfroLife Edir የሥራ ቦታ', om: 'Iddoo hojii Edir AfroLife', ti: 'ቦታ ስራሕ Edir AfroLife', so: 'Goobta shaqada AfroLife Edir', ar: 'مساحة عمل إدير AfroLife', sw: 'Nafasi ya kazi ya AfroLife Edir',
  },
  'Insurance information': {
    am: 'የኢንሹራንስ መረጃ', om: 'Odeeffannoo inshuraansii', ti: 'ሓበሬታ ውሕስነት', so: 'Macluumaadka caymiska', ar: 'معلومات التأمين', sw: 'Taarifa za bima',
  },
  'Document requirements are not available yet. Try again before submitting.': {
    am: 'የሰነድ መስፈርቶች ገና አልተገኙም። ከማስገባትዎ በፊት እንደገና ይሞክሩ።', om: 'Ulaagaaleen sanadaa ammaaf hin argamne. Erguu dura irra deebiʼaa yaalaa.', ti: 'መስፈርታት ሰነድ ገና ኣይተረኽቡን። ቅድሚ ምቕራብ እንደገና ፈትኑ።', so: 'Shuruudaha dukumentiyada weli lama heli karo. Mar kale isku day ka hor intaadan gudbin.', ar: 'متطلبات المستندات غير متاحة بعد. حاول مرة أخرى قبل الإرسال.', sw: 'Mahitaji ya hati bado hayapatikani. Jaribu tena kabla ya kuwasilisha.',
  },
  'No identity documents are required for this account type.': {
    am: 'ለዚህ የመለያ ዓይነት የመታወቂያ ሰነዶች አያስፈልጉም።', om: 'Gosa herregaa kanaaf sanadoonni eenyummaa hin barbaachisan.', ti: 'ንዚ ዓይነት ሕሳብ ሰነዳት መንነት ኣየድልዩን።', so: 'Noocan akoonka ah looma baahna dukumentiyo aqoonsi.', ar: 'لا تُطلب مستندات هوية لهذا النوع من الحسابات.', sw: 'Aina hii ya akaunti haihitaji hati za utambulisho.',
  },
  'Your registration is pending review. Check document decisions below and replace any document returned by Compliance.': {
    am: 'ምዝገባዎ ግምገማ ላይ ነው። ከታች ያሉትን የሰነድ ውሳኔዎች ይመልከቱና በተገዢነት ቡድን የተመለሰ ሰነድ ይተኩ።', om: 'Galmeen keessan gamaaggama eeggachaa jira. Murtii sanadaa armaan gadii ilaalaa; sanada kutaa to’annoo seeraatiin deebifame kamiyyuu bakka buusaa.', ti: 'ምዝገባኹም ገና ኣብ ግምገማ ኣሎ። ኣብ ታሕቲ ዘሎ ውሳነታት ሰነድ ርኣዩ፣ ብክፍሊ ተገዢነት ዝተመልሰ ሰነድ ድማ ተክኡ።', so: 'Diiwaangelintaadu waxay sugaysaa dib-u-eegis. Hoos ka eeg go’aamada dukumentiyada, kuna beddel dukumenti kasta oo ay kooxda u hoggaansanaantu soo celisay.', ar: 'طلب تسجيلك قيد المراجعة. راجع قرارات المستندات أدناه واستبدل أي مستند أعاده فريق الامتثال.', sw: 'Usajili wako unasubiri kukaguliwa. Angalia maamuzi ya hati hapa chini na ubadilishe hati yoyote iliyorejeshwa na timu ya uzingatiaji.',
  },
  'All required documents are received. Compliance will review them before account activation.': {
    am: 'ሁሉም የሚፈለጉ ሰነዶች ደርሰዋል። መለያው ከመንቃቱ በፊት የተገዢነት ቡድን ይገመግማቸዋል።', om: 'Sanadoonni barbaachisan hundi nu gaʼaniiru. Herregni hojii irra ooluu dura kutaan to’annoo seeraa ni gamaaggama.', ti: 'ኩሎም ዝድለዩ ሰነዳት በጺሖም። ሕሳብ ቅድሚ ምንቃሑ ክፍሊ ተገዢነት ክግምግሞም እዩ።', so: 'Dhammaan dukumentiyada loo baahan yahay waa la helay. Kooxda u hoggaansanaantu way dib u eegi doontaa ka hor inta aan akoonka la hawlgelin.', ar: 'تم استلام جميع المستندات المطلوبة. سيراجعها فريق الامتثال قبل تفعيل الحساب.', sw: 'Hati zote zinazohitajika zimepokelewa. Timu ya uzingatiaji itazikagua kabla ya akaunti kuamilishwa.',
  },
  'Choose a returned or missing document and select a replacement file.': {
    am: 'የተመለሰ ወይም የጎደለ ሰነድ ይምረጡና የሚተካውን ፋይል ይምረጡ።', om: 'Sanada deebifame yookaan hirʼate filadhaa; achiis faayila bakka buʼu filadhaa.', ti: 'ዝተመልሰ ወይ ዝጎደለ ሰነድ ምረጹ፣ ተኪኡ ዝኸውን ፋይል ድማ ምረጹ።', so: 'Dooro dukumenti la soo celiyey ama maqan, dabadeed dooro fayl lagu beddelayo.', ar: 'اختر مستندًا مُعادًا أو مفقودًا، ثم اختر ملفًا بديلًا.', sw: 'Chagua hati iliyorejeshwa au inayokosekana, kisha uchague faili ya kuibadilisha.',
  },
  'This file exceeds the 10 MB upload limit.': {
    am: 'ይህ ፋይል ከ10 MB የመጫኛ ገደብ ይበልጣል።', om: 'Faayilli kun daangaa olkaaʼinsaa 10 MB caala.', ti: 'እዚ ፋይል ካብ ደረት ምጽዓን 10 MB ይበልጽ።', so: 'Faylkani wuxuu ka weyn yahay xadka 10 MB ee la gelin karo.', ar: 'يتجاوز حجم هذا الملف الحد الأقصى للرفع وهو 10 ميغابايت.', sw: 'Faili hii imezidi kikomo cha upakiaji cha MB 10.',
  },
  'Choose a PDF, JPEG or PNG document.': {
    am: 'PDF፣ JPEG ወይም PNG ሰነድ ይምረጡ።', om: 'Sanada PDF, JPEG yookaan PNG filadhaa.', ti: 'ሰነድ PDF፣ JPEG ወይ PNG ምረጹ።', so: 'Dooro dukumenti PDF, JPEG ama PNG ah.', ar: 'اختر مستندًا بصيغة PDF أو JPEG أو PNG.', sw: 'Chagua hati ya PDF, JPEG au PNG.',
  },
  'Some areas could not be searched. Results may be partial.': {
    am: 'አንዳንድ አካባቢዎችን መፈለግ አልተቻለም። ውጤቶቹ ያልተሟሉ ሊሆኑ ይችላሉ።', om: 'Naannoowwan tokko tokko barbaaduun hin dandaʼamne. Buʼaawwan guutuu taʼuu dhiisuu dandaʼu.', ti: 'ኣብ ገለ ከባቢታት ምድላይ ኣይተኻእለን። ውጽኢታት ዘይተማልኡ ክኾኑ ይኽእሉ።', so: 'Meelaha qaarkood lama raadin karin. Natiijooyinku waxay noqon karaan kuwo aan dhammaystirnayn.', ar: 'تعذر البحث في بعض المناطق. قد تكون النتائج غير مكتملة.', sw: 'Baadhi ya maeneo hayakuweza kutafutwa. Matokeo yanaweza kuwa pungufu.',
  },
  'No matching records were found in the areas available to your role.': {
    am: 'ለእርስዎ ሚና በተፈቀዱ አካባቢዎች ውስጥ የሚዛመድ መዝገብ አልተገኘም።', om: 'Naannoowwan gahee keessaniif hayyamaman keessatti galmeen walsimu hin argamne.', ti: 'ኣብቶም ንሚናኹም ዝተፈቕዱ ከባቢታት ዝሰማማዕ መዝገብ ኣይተረኽበን።', so: 'Meelaha doorkaaga loo oggol yahay lagama helin diiwaanno is waafaqaya.', ar: 'لم يتم العثور على سجلات مطابقة في المناطق المتاحة لدورك.', sw: 'Hakuna rekodi zinazolingana zilizopatikana katika maeneo yanayoruhusiwa kwa jukumu lako.',
  },
  'Counts reflect records currently available to your account.': {
    am: 'ቁጥሮቹ በአሁኑ ጊዜ ለመለያዎ የሚታዩ መዝገቦችን ያንጸባርቃሉ።', om: 'Lakkoofsi galmeewwan yeroo ammaa herrega keessaniif argaman agarsiisa.', ti: 'እቶም ቁጽርታት ኣብዚ እዋን ንሕሳብኩም ዝርከቡ መዝገባት የንጸባርቑ።', so: 'Tirooyinku waxay muujinayaan diiwaannada hadda akoonkaaga u bannaan.', ar: 'تعكس الأعداد السجلات المتاحة حاليًا لحسابك.', sw: 'Idadi zinaonyesha rekodi zinazopatikana kwa akaunti yako kwa sasa.',
  },
  'Explore Edir membership and available benefits': {
    am: 'የእድር አባልነትንና ያሉ ጥቅሞችን ይመልከቱ', om: 'Miseensummaa Edir fi faayidaalee jiran qoradhaa', ti: 'ኣባልነት Edirን ዘለዉ ረብሓታትን ተዳህስሱ', so: 'Baadh xubinnimada Edir iyo faa’iidooyinka la heli karo', ar: 'استكشف عضوية إدير والمزايا المتاحة', sw: 'Chunguza uanachama wa Edir na manufaa yanayopatikana',
  },
  'Open to verified AfroLife users across worker, employer, landlord, tenant, seller, and buyer services. Review active community, savings, share, and contribution options before requesting membership. Lending, insurance, and benefit payouts are not live in this pilot.': {
    am: 'በሠራተኛ፣ በአሠሪ፣ በአከራይ፣ በተከራይ፣ በሻጭና በገዢ አገልግሎቶች ያሉ የተረጋገጡ የAfroLife ተጠቃሚዎች ማመልከት ይችላሉ። አባልነት ከመጠየቅዎ በፊት የሚሠሩ የማኅበረሰብ፣ የቁጠባ፣ የአክሲዮንና የመዋጮ አማራጮችን ይመልከቱ። በዚህ የሙከራ ፕሮግራም ብድር፣ ኢንሹራንስና የጥቅም ክፍያዎች አይሠሩም።',
    om: 'Tajaajila hojjetaa, hojjechiisaa, abbaa mana kiraa, kireeffataa, gurguraa fi bitataa keessatti fayyadamtoonni AfroLife mirkanaaʼan iyyachuu dandaʼu. Miseensummaa gaafachuu dura filannoowwan hawaasaa, qusannoo, qooda fi gumaachaa hojii irra jiran ilaalaa. Pilootii kana keessatti liqiin, inshuraansiin fi kaffaltiin faayidaa hin hojjetan.',
    ti: 'ኣብ ኣገልግሎት ሰራሕተኛ፣ ኣስራሒ፣ ኣካራዪ፣ ተኻራዪ፣ ሻየጣይን ገዛእን ዘለዉ ዝተረጋገጹ ተጠቀምቲ AfroLife ክሓቱ ይኽእሉ። ኣባልነት ቅድሚ ምሕታትኩም ንጡፋት ኣማራጺታት ማሕበረሰብ፣ ዕቋር፣ ኣክስዮንን ኣበርክቶን ርኣዩ። ኣብዚ ፓይሎት ልቓሕ፣ ውሕስነትን ክፍሊት ጥቕምን ገና ኣይሰርሑን።',
    so: 'Isticmaalayaasha AfroLife ee la xaqiijiyey ee ka tirsan adeegyada shaqaalaha, loo-shaqeeyayaasha, mulkiilayaasha, kiraystayaasha, iibiyeyaasha iyo iibsadayaasha way codsan karaan. Ka hor codsiga xubinnimada, eeg adeegyada bulshada, kaydka, saamiyada iyo tabarucaadka ee shaqaynaya. Amaahda, caymiska iyo bixinta faa’iidooyinku kama shaqeeyaan tijaabadan.',
    ar: 'الخدمة متاحة لمستخدمي AfroLife المعتمدين ضمن خدمات العمال وأصحاب العمل ومُلّاك العقارات والمستأجرين والبائعين والمشترين. راجع خيارات المجتمع والادخار والأسهم والمساهمات النشطة قبل طلب العضوية. الإقراض والتأمين وصرف المزايا غير متاح في هذه المرحلة التجريبية.',
    sw: 'Watumiaji wa AfroLife waliothibitishwa katika huduma za wafanyakazi, waajiri, wamiliki wa nyumba, wapangaji, wauzaji na wanunuzi wanaweza kujiunga. Kagua chaguo za jamii, akiba, hisa na michango zinazotumika kabla ya kuomba uanachama. Mikopo, bima na malipo ya manufaa havipatikani katika majaribio haya.',
  },
  'Your service mini-apps': {
    am: 'የአገልግሎት ሚኒ-መተግበሪያዎችዎ', om: 'Mini-appoota tajaajilaa keessan', ti: 'ሚኒ-ኣፕሊኬሽናት ኣገልግሎትኩም', so: 'Barnaamijyada yaryar ee adeegyadaada', ar: 'تطبيقات الخدمات المصغّرة الخاصة بك', sw: 'Programu ndogo za huduma zako',
  },
  'Super App': {
    am: 'ሱፐር አፕ', om: 'Appii tajaajila waliigalaa', ti: 'ሱፐር ኣፕ', so: 'App-ka Guud', ar: 'التطبيق الشامل', sw: 'Programu Kuu',
  },
  'Accounting & Finance': {
    am: 'ሂሳብ እና ፋይናንስ', om: 'Herrega fi Faayinaansii', ti: 'ሒሳብን ፋይናንስን', so: 'Xisaabaadka & Maaliyadda', ar: 'المحاسبة والمالية', sw: 'Uhasibu na Fedha',
  },
  'Manage entity books, journals, financial operations, and entity-scoped reporting.': {
    am: 'የድርጅት መዝገቦችን፣ ጆርናሎችን፣ የፋይናንስ ሥራዎችን እና በድርጅት የተገደቡ ሪፖርቶችን ያስተዳድሩ።',
    om: 'Galmeewwan dhaabbataa, galmee herregaa, hojiiwwan faayinaansii fi gabaasa daangaa dhaabbataatiin bulchaa.',
    ti: 'መዝገባት ትካል፣ ጆርናላት፣ ስራሕ ፋይናንስን ሪፖርታት ብትካል ዝተወሰኑን ኣመሓድሩ።',
    so: 'Maamul buugaagta hay’adda, joornaallada, hawlaha maaliyadeed iyo warbixinnada ku kooban hay’adda.',
    ar: 'أدر دفاتر الكيانات والقيود اليومية والعمليات المالية والتقارير المقيدة بالكيان.',
    sw: 'Dhibiti vitabu vya taasisi, majarida, shughuli za fedha na ripoti za taasisi husika.',
  },
  'Accounting mini app →': {
    am: 'ሂሳብ ሚኒ አፕ →', om: 'Mini-appii herregaa →', ti: 'ሚኒ ኣፕ ሒሳብ →', so: 'Barnaamijka yar ee xisaabaadka →', ar: 'تطبيق المحاسبة المصغّر ←', sw: 'Programu ndogo ya uhasibu →',
  },
  'No services are assigned to your account yet.': {
    am: 'እስካሁን ምንም አገልግሎት ለመለያዎ አልተመደበም።',
    om: 'Hanga ammaatti tajaajilli tokko illee herrega keessaniif hin ramadamne.',
    ti: 'ክሳብ ሕጂ ንመለያኹም ዝተመደበ ኣገልግሎት የለን።',
    so: 'Ilaa hadda adeeg laguma qoondeyn akoonkaaga.',
    ar: 'لم تُخصّص أي خدمات لحسابك حتى الآن.',
    sw: 'Bado hakuna huduma iliyopangiwa akaunti yako.',
  },
  'Open an available service directly. Access is based on your role and enabled features.': {
    am: 'ያለውን አገልግሎት በቀጥታ ይክፈቱ። መዳረሻዎ በሚናዎና በነቁ ባህሪያት ይወሰናል።', om: 'Tajaajila jiru kallattiin banaa. Seensaan gahee keessanii fi amaloota hojii irra jiraniin murtaaʼa.', ti: 'ኣብ ዘሎ ኣገልግሎት ብቐጥታ ክፈቱ። መእተዊ ብሚናኹምን ንጡፋት ባህርያትን ይውሰን።', so: 'Si toos ah u fur adeegga la heli karo. Gelitaanku wuxuu ku xiran yahay doorkaaga iyo astaamaha la hawlgeliyey.', ar: 'افتح الخدمة المتاحة مباشرةً. يعتمد الوصول على دورك والميزات المفعّلة.', sw: 'Fungua huduma inayopatikana moja kwa moja. Ufikiaji hutegemea jukumu lako na vipengele vilivyowezeshwa.',
  },
  'Choose an agent': {
    am: 'ወኪል ይምረጡ', om: 'Bakka buʼaa filadhaa', ti: 'ወኪል ምረጹ', so: 'Dooro wakiil', ar: 'اختر وكيلًا', sw: 'Chagua wakala',
  },
  'Audience roles': {
    am: 'የታላሚ ሚናዎች', om: 'Gaheewwan dhaggeeffattootaa', ti: 'ሚናታት ተዓዘብቲ', so: 'Doorarka dadka loogu talagalay', ar: 'أدوار الجمهور المستهدف', sw: 'Majukumu ya hadhira',
  },
  'AfroLife managed listing': {
    am: 'በAfroLife የሚተዳደር ዝርዝር', om: 'Tarree AfroLife bulchuu', ti: 'ዝርዝር ብAfroLife ዝመሓደር', so: 'Liis uu maamulo AfroLife', ar: 'قائمة تديرها AfroLife', sw: 'Tangazo linalosimamiwa na AfroLife',
  },
  'On Android, take or choose photos and videos. Media stays private and is shown only to authorized users.': {
    am: 'በAndroid ላይ ፎቶና ቪዲዮ ያንሱ ወይም ይምረጡ። ሚዲያው በግል ይቀመጣል፣ ለተፈቀዱ ተጠቃሚዎች ብቻ ይታያል።', om: 'Android irratti suuraa fi viidiyoo kaʼaa yookaan filadhaa. Meediyaan iccitiidhaan kuufama; fayyadamtoota hayyamamaniif qofa mulʼata.', ti: 'ኣብ Android ስእልን ቪድዮን ኣንስኡ ወይ ምረጹ። ሚድያ ብምስጢር ይቕመጥ፣ ንዝተፈቕደሎም ተጠቀምቲ ጥራይ ይርአ።', so: 'Android-ka ku qaad ama ka dooro sawirro iyo muuqaallo. Faylasha warbaahintu waa qarsoodi, waxaana arki kara oo keliya isticmaalayaasha loo oggolaaday.', ar: 'على Android، التقط الصور ومقاطع الفيديو أو اخترها. تبقى الوسائط خاصة ولا تظهر إلا للمستخدمين المصرّح لهم.', sw: 'Kwenye Android, piga au chagua picha na video. Midia huhifadhiwa kwa faragha na huonyeshwa kwa watumiaji walioidhinishwa pekee.',
  },
  'Owner rent & deposit statements': {
    am: 'የባለቤት የኪራይና የተቀማጭ መግለጫዎች', om: 'Ibsa kiraa fi wabii abbaa qabeenyaa', ti: 'መግለጺታት ክራይን ተቐማጢን ዋና ንብረት', so: 'Warbixinnada kirada iyo deebaajiga milkiilaha', ar: 'كشوفات الإيجار والودائع للمالك', sw: 'Taarifa za kodi na amana za mwenye nyumba',
  },
  'These read-only records show lease charges and reconciled rent/deposit receipts. They do not initiate or confirm a payout to you.': {
    am: 'እነዚህ ሊቀየሩ የማይችሉ መዝገቦች የኪራይ ክፍያዎችንና የተስተካከሉ የኪራይ/ተቀማጭ ደረሰኞችን ያሳያሉ። ለእርስዎ ክፍያ አያስጀምሩም ወይም አያረጋግጡም።', om: 'Galmeewwan dubbisuu qofaaf taʼan kun kaffaltii kireeffannaa fi nagahee kiraa/wabii wal-simsiifame agarsiisu. Isiniif kaffaltii hin jalqaban yookaan hin mirkaneessan.', ti: 'እዞም ክንበቡ ጥራይ ዝኽእሉ መዝገባት ክፍሊታት ውዕሊ ክራይን ዝተሰማምዑ ደረሰኛታት ክራይ/ተቐማጢን የርእዩ። ንዓኹም ክፍሊት ኣይጅምሩን ወይ ኣየረጋግጹን።', so: 'Diiwaannadan akhris-keliya ah waxay muujinayaan kharashka heshiiska kirada iyo rasiidhada kirada/deebaajiga ee la waafajiyey. Ma bilaabaan mana xaqiijiyaan lacag adiga laguu soo dirayo.', ar: 'تعرض هذه السجلات المخصّصة للقراءة فقط رسوم عقد الإيجار وإيصالات الإيجار/الوديعة التي تمت تسويتها. وهي لا تبدأ صرف مبلغ لك ولا تؤكده.', sw: 'Rekodi hizi za kusoma pekee zinaonyesha ada za upangaji na risiti za kodi/amana zilizolinganishwa. Hazianzi wala kuthibitisha malipo kwako.',
  },
  'Open a maintenance request': {
    am: 'የጥገና ጥያቄ ይክፈቱ', om: 'Gaaffii suphaa banuu', ti: 'ሕቶ ጽገና ክፈቱ', so: 'Fur codsi dayactir', ar: 'افتح طلب صيانة', sw: 'Fungua ombi la matengenezo',
  },
  'Choose a property': {
    am: 'ንብረት ይምረጡ', om: 'Qabeenya filadhaa', ti: 'ንብረት ምረጹ', so: 'Dooro hanti', ar: 'اختر عقارًا', sw: 'Chagua nyumba',
  },
  'Common area / property': {
    am: 'የጋራ ቦታ / ንብረት', om: 'Iddoo waliinii / qabeenya', ti: 'ናይ ሓባር ቦታ / ንብረት', so: 'Meel guud / hanti', ar: 'منطقة مشتركة / عقار', sw: 'Eneo la pamoja / nyumba',
  },
  'All properties': {
    am: 'ሁሉም ንብረቶች', om: 'Qabeenya hunda', ti: 'ኩሎም ንብረታት', so: 'Dhammaan hantida', ar: 'جميع العقارات', sw: 'Nyumba zote',
  },
  'Test checkout only. No real payment is taken.': {
    am: 'ይህ የሙከራ ክፍያ ብቻ ነው። እውነተኛ ክፍያ አይፈጸምም።', om: 'Kun kaffaltii yaalii qofa. Kaffaltiin dhugaa hin raawwatamu.', ti: 'እዚ ናይ ፈተነ ክፍሊት ጥራይ እዩ። ናይ ሓቂ ክፍሊት ኣይውሰድን።', so: 'Kani waa tijaabo lacag-bixin oo keliya. Lacag dhab ah lagama qaadayo.', ar: 'هذه عملية دفع تجريبية فقط. لن يتم تحصيل أي مبلغ حقيقي.', sw: 'Huu ni ukaguzi wa malipo ya majaribio pekee. Hakuna malipo halisi yatakayochukuliwa.',
  },
  'Marketplace report dashboard': {
    am: 'የገበያ ቦታ ሪፖርት ዳሽቦርድ', om: 'Daashboordii gabaasa gabaa', ti: 'ዳሽቦርድ ሪፖርት ዕዳጋ', so: 'Guddiga warbixinta suuqa', ar: 'لوحة تقارير السوق', sw: 'Dashibodi ya ripoti za soko',
  },
  'Marketplace listing prices are not payments. Local mock mode supports a sandbox order and simulated payment for published fixed-price sales; it never charges a buyer or posts to Accounting. Real checkout, buyer memberships, wallets, loans, and purchase history remain unavailable.': {
    am: 'የገበያ ዝርዝር ዋጋዎች ክፍያዎች አይደሉም። የአካባቢ ማስመሰያ ሁነታ ለታተሙ ቋሚ ዋጋ ሽያጮች የሙከራ ትዕዛዝና የተመሰለ ክፍያ ይደግፋል፤ ገዢን አያስከፍልም ወይም ወደ ሂሳብ አያስገባም። እውነተኛ ክፍያ፣ የገዢ አባልነት፣ የገንዘብ ቦርሳ፣ ብድርና የግዢ ታሪክ አሁንም አይገኙም።',
    om: 'Gatiin tarree gabaa kaffaltii miti. Haalli fakkeessaa naannoo ajaja yaalii fi kaffaltii fakkeeffame gurgurtaa gatii murtaaʼaa maxxanfameef ni deeggara; bitataa irraa kaffaltii hin fudhatu, gara herrega maallaqaattis hin galmeessu. Kaffaltiin dhugaa, miseensummaan bitataa, boorsaan maallaqaa, liqii fi seenaa bittaa ammaaf hin jirani.',
    ti: 'ዋጋታት ዝርዝር ዕዳጋ ክፍሊት ኣይኮኑን። ናይ ከባቢ ሞክ ሞድ ንዝተሓትሙ ብቋሚ ዋጋ ዝሽየጡ ንብረታት ናይ ፈተነ ትእዛዝን ዝተመስለ ክፍሊትን ይድግፍ፤ ንገዛኢ ገንዘብ ኣይእክብን ናብ ሒሳብ ኣይልእኽን። ናይ ሓቂ ክፍሊት፣ ኣባልነት ገዛኢ፣ ቦርሳ ገንዘብ፣ ልቓሕን ታሪኽ ግዢን ገና ኣይርከቡን።',
    so: 'Qiimaha liisaska suuqu ma aha lacag-bixinno. Habka tijaabada maxalliga ah wuxuu taageeraa dalab iyo lacag-bixin la matalay oo loogu talagalay iibyada qiimaha go’an ee la daabacay; wax lacag ah kama qaado iibsadaha mana diiwaangeliyo Xisaabaadka. Lacag-bixin dhab ah, xubinnimada iibsadaha, boorsooyin, amaah iyo taariikhda wax-iibsigu weli lama heli karo.',
    ar: 'أسعار قوائم السوق ليست مدفوعات. يدعم وضع المحاكاة المحلي طلبًا تجريبيًا ودفعًا محاكى للمبيعات المنشورة ذات السعر الثابت؛ ولا يخصم من المشتري أو يرحّل قيدًا إلى المحاسبة. الدفع الفعلي وعضويات المشترين والمحافظ والقروض وسجل المشتريات غير متاحة حاليًا.',
    sw: 'Bei za matangazo ya sokoni si malipo. Hali ya majaribio ya ndani inaruhusu oda ya majaribio na malipo yaliyoigwa kwa mauzo ya bei maalumu yaliyochapishwa; haimtozi mnunuzi wala kutuma taarifa kwenye Uhasibu. Malipo halisi, uanachama wa wanunuzi, pochi, mikopo na historia ya ununuzi bado havipatikani.',
  },
  'Your detailed listing activity': {
    am: 'ዝርዝር የማስታወቂያ እንቅስቃሴዎ', om: 'Sochii balʼinaan tarreeffame', ti: 'ዝርዝር ንጥፈት ዝርዝርኩም', so: 'Faahfaahinta dhaqdhaqaaqa liiskaaga', ar: 'تفاصيل نشاط قائمتك', sw: 'Shughuli za kina za tangazo lako',
  },
  'No marketplace listing activity is linked to your account.': {
    am: 'ከመለያዎ ጋር የተያያዘ የገበያ ዝርዝር እንቅስቃሴ የለም።', om: 'Sochiin tarree gabaa herrega keessan waliin walqabate hin jiru.', ti: 'ምስ ሕሳብኩም ዝተኣሳሰረ ንጥፈት ዝርዝር ዕዳጋ የለን።', so: 'Ma jiro dhaqdhaqaaq liis suuqeed oo ku xiran akoonkaaga.', ar: 'لا يوجد نشاط لقوائم السوق مرتبط بحسابك.', sw: 'Hakuna shughuli za matangazo ya sokoni zilizounganishwa na akaunti yako.',
  },
  'Insurance report dashboard': {
    am: 'የኢንሹራንስ ሪፖርት ዳሽቦርድ', om: 'Daashboordii gabaasa inshuraansii', ti: 'ዳሽቦርድ ሪፖርት ውሕስነት', so: 'Guddiga warbixinta caymiska', ar: 'لوحة تقارير التأمين', sw: 'Dashibodi ya ripoti za bima',
  },
  'Insurance policy enrollment, claims, member wallets, and loans are not available in this platform. Existing Insurance ledgers are separate organization accounting records and do not prove personal cover or a payment balance.': {
    am: 'በዚህ መድረክ የኢንሹራንስ ፖሊሲ ምዝገባ፣ የጥያቄ ክፍያ፣ የአባላት የገንዘብ ቦርሳና ብድር አይገኙም። ያሉት የኢንሹራንስ ደብተሮች የድርጅት የሂሳብ መዝገቦች ናቸው፤ የግል ሽፋንን ወይም የክፍያ ቀሪን አያረጋግጡም።',
    om: 'Waltajjiin inshuraansii, gaafannaan beenyaa, boorsaan miseensotaa fi liqiin waltajjii kana irratti hin argaman. Galmeewwan inshuraansii jiran galmeewwan herrega dhaabbata addaati; inshuraansii dhuunfaa yookaan baaqii kaffaltii hin mirkaneessan.',
    ti: 'ኣብዚ መድረኽ ምዝገባ ፖሊሲ ውሕስነት፣ ክሲ ካሕሳ፣ ቦርሳ ኣባላትን ልቓሕን ኣይርከቡን። ዘለዉ መዝገባት ውሕስነት ናይ በይኖም ናይ ትካል ሒሳብ መዝገባት እዮም፣ ውልቃዊ ሽፋን ወይ ቀሪ ክፍሊት ኣየረጋግጹን።',
    so: 'Diiwaangelinta siyaasadda caymiska, sheegashooyinka, boorsooyinka xubnaha iyo amaahdu lagama heli karo madashan. Diiwaannada caymiska ee jira waa diiwaanno xisaabeed oo urur oo gooni ah, mana caddaynayaan caymis shakhsi ah ama hadhaaga lacag-bixin.',
    ar: 'لا يتوفر في هذه المنصة التسجيل في وثائق التأمين أو المطالبات أو محافظ الأعضاء أو القروض. سجلات التأمين الحالية هي سجلات محاسبية منفصلة للمؤسسة، ولا تثبت وجود تغطية شخصية أو رصيد مستحق.',
    sw: 'Usajili wa sera za bima, madai, pochi za wanachama na mikopo havipatikani kwenye jukwaa hili. Daftari za bima zilizopo ni rekodi tofauti za uhasibu wa shirika, na hazithibitishi bima ya mtu binafsi au salio la malipo.',
  },
  'Agents may only make a consented, non-binding follow-up or refer a customer to the Insurance service team. Product recommendations, comparisons, quotes, premium collection, policy issuance or changes, and claims decisions are not available.': {
    am: 'ወኪሎች በደንበኛው ፈቃድ የማያስገድድ ክትትል ብቻ ማድረግ ወይም ደንበኛውን ወደ ኢንሹራንስ አገልግሎት ቡድን መላክ ይችላሉ። የምርት ምክር፣ ማነጻጸር፣ የዋጋ ጥቅስ፣ ፕሪሚየም መሰብሰብ፣ ፖሊሲ ማውጣት ወይም መቀየር፣ እና የጥያቄ ውሳኔ አይገኙም።',
    om: 'Bakka buʼoonni hordoffii hayyama maamilaan, isa dirqama hin taane, gochuu yookaan maamila gara garee tajaajila inshuraansiitti erguu qofa dandaʼu. Gorsaan oomishaa, walbira qabuu, tilmaamni gatii, walitti qabaan kaffaltii inshuraansii, baasiin yookaan jijjiirraan poolisii, fi murtiin gaaffii beenyaa hin kennaman.',
    ti: 'ወከልቲ ብፍቓድ ዓሚል ዘይግድን ምክትታል ጥራይ ክገብሩ ወይ ንዓሚል ናብ ጉጅለ ኣገልግሎት ውሕስነት ክመርሑ ይኽእሉ። ምኽሪ ፍርያት፣ ምንጽጻር፣ ጥቕሲ ዋጋ፣ ምእካብ ፕሪሚየም፣ ምውጻእ ወይ ምቕያር ፖሊሲን ውሳነ ክሲን ኣይርከቡን።',
    so: 'Wakiilladu waxay samayn karaan oo keliya dabagal aan qasab ahayn oo oggolaansho lagu saleeyey ama waxay macmiilka u gudbin karaan kooxda adeegga Caymiska. Talooyinka badeecadaha, isbarbardhigga, qiime-soo-jeedinta, ururinta khidmadaha, bixinta ama beddelka siyaasadaha, iyo go’aamada sheegashooyinka lama bixiyo.',
    ar: 'يقتصر دور الوكلاء على متابعة غير ملزمة بموافقة العميل أو إحالته إلى فريق خدمات التأمين. لا تتوفر توصيات المنتجات أو المقارنات أو عروض الأسعار أو تحصيل الأقساط أو إصدار الوثائق أو تعديلها أو اتخاذ قرارات المطالبات.',
    sw: 'Mawakala wanaweza tu kufanya ufuatiliaji usio wa lazima kwa ridhaa ya mteja au kumwelekeza kwa timu ya huduma za Bima. Mapendekezo na ulinganisho wa bidhaa, makadirio ya bei, ukusanyaji wa ada, utoaji au mabadiliko ya sera, na maamuzi ya madai hayapatikani.',
  },
  'EthioLife Edir membership offer': {
    am: 'የEthioLife እድር አባልነት ጥያቄ', om: 'Dhiyeessa miseensummaa Edir EthioLife', ti: 'ቅርቦት ኣባልነት Edir EthioLife', so: 'Dalabka xubinnimada Edir ee EthioLife', ar: 'عرض عضوية إدير من EthioLife', sw: 'Ofa ya uanachama wa EthioLife Edir',
  },
  'Edir membership is available to registered workers, employers, landlords, tenants, sellers, buyers, and other EthioLife users after KYC has been verified. Complete KYC review to request membership.': {
    am: 'የKYC ማረጋገጫ ከተጠናቀቀ በኋላ የእድር አባልነት ለተመዘገቡ ሠራተኞች፣ አሠሪዎች፣ አከራዮች፣ ተከራዮች፣ ሻጮች፣ ገዢዎችና ሌሎች የEthioLife ተጠቃሚዎች ይገኛል። አባልነት ለመጠየቅ የKYC ግምገማውን ያጠናቅቁ።',
    om: 'Miseensummaan Edir hojjettoota, hojjechiistota, abbootii mana kiraa, kireeffattoota, gurgurtootaa, bitattootaa fi fayyadamtoota EthioLife biroof galmee KYC erga mirkanaaʼee booda ni argama. Miseensummaa gaafachuuf gamaaggama KYC xumuraa.',
    ti: 'ምርመራ KYC ምስ ተረጋገጸ ኣባልነት Edir ንዝተመዝገቡ ሰራሕተኛታት፣ ኣስራሕቲ፣ ኣካረይቲ፣ ተኻረይቲ፣ ሻየጥቲ፣ ገዛእቲን ካልኦት ተጠቀምቲ EthioLifeን ይርከብ። ኣባልነት ንምሕታት ግምገማ KYC ዛዝሙ።',
    so: 'Xubinnimada Edir waxay heli karaan shaqaale, loo-shaqeeyayaal, mulkiilayaal, kiraystayaal, iibiyayaal, iibsadayaal iyo isticmaalayaasha kale ee EthioLife ee diiwaangashan marka KYC la xaqiijiyo. Dhammaystir dib-u-eegista KYC si aad u codsato xubinnimo.',
    ar: 'تتاح عضوية إدير للعمال وأصحاب العمل ومُلّاك العقارات والمستأجرين والبائعين والمشترين وغيرهم من مستخدمي EthioLife المسجلين بعد التحقق من KYC. أكمل مراجعة KYC لطلب العضوية.',
    sw: 'Uanachama wa Edir unapatikana kwa wafanyakazi, waajiri, wamiliki wa nyumba, wapangaji, wauzaji, wanunuzi na watumiaji wengine wa EthioLife waliosajiliwa baada ya KYC kuthibitishwa. Kamilisha ukaguzi wa KYC ili kuomba uanachama.',
  },
  'Request EthioLife Edir membership': {
    am: 'የEthioLife እድር አባልነት ይጠይቁ', om: 'Miseensummaa Edir EthioLife gaafadhaa', ti: 'ኣባልነት Edir EthioLife ሕተቱ', so: 'Codso xubinnimada Edir ee EthioLife', ar: 'اطلب عضوية إدير من EthioLife', sw: 'Omba uanachama wa EthioLife Edir',
  },
  'I understand this pilot records a membership request only. No dues, contributions, insurance, or payouts are collected or promised.': {
    am: 'ይህ የሙከራ ፕሮግራም የአባልነት ጥያቄን ብቻ እንደሚመዘግብ ተረድቻለሁ። ክፍያ፣ መዋጮ፣ ኢንሹራንስ ወይም የጥቅም ክፍያ አይሰበሰብም ወይም ቃል አይገባም።',
    om: 'Pilootiin kun gaaffii miseensummaa qofa akka galmeessu hubadheera. Kaffaltiin miseensummaa, gumaachi, inshuraansiin yookaan kaffaltiin faayidaa hin sassaabamu yookaan hin waadaa galamu.',
    ti: 'እዚ ፓይሎት ሕቶ ኣባልነት ጥራይ ከም ዝምዝግብ ተረዲአ ኣለኹ። ክፍሊት ኣባልነት፣ ኣበርክቶ፣ ውሕስነት ወይ ክፍሊት ጥቕሚ ኣይእከብን ወይ ቃል ኣይኣቱን።',
    so: 'Waan fahamsanahay in tijaabadani ay diiwaangelinayso codsi xubinnimo oo keliya. Lacag xubinnimo, tabarucaad, caymis ama lacag-bixin faa’iido lama qaadayo lamana ballanqaadayo.',
    ar: 'أفهم أن هذه المرحلة التجريبية تسجل طلب العضوية فقط. لن يتم تحصيل أو التعهد برسوم أو مساهمات أو تأمين أو مدفوعات مزايا.',
    sw: 'Ninaelewa kuwa jaribio hili linasajili ombi la uanachama pekee. Ada, michango, bima au malipo ya manufaa hayakusanywi wala kuahidiwa.',
  },
  'Available Edir benefits and services': {
    am: 'ያሉ የእድር ጥቅሞችና አገልግሎቶች', om: 'Faayidaalee fi tajaajiloota Edir jiran', ti: 'ዘለዉ ረብሓታትን ኣገልግሎታትን Edir', so: 'Faa’iidooyinka iyo adeegyada Edir ee la heli karo', ar: 'مزايا وخدمات إدير المتاحة', sw: 'Manufaa na huduma za Edir zinazopatikana',
  },
  'Membership includes a reviewed request to join the central Edir community. The active product options below are set by EthioLife Edir administrators and may be subject to product terms and approval.': {
    am: 'አባልነት ማዕከላዊውን የእድር ማኅበረሰብ ለመቀላቀል የሚቀርብና የሚገመገም ጥያቄን ያካትታል። ከታች ያሉት ንቁ የምርት አማራጮች በEthioLife Edir አስተዳዳሪዎች ይወሰናሉ፤ የምርት ውሎችና ፈቃድ ሊያስፈልጉ ይችላሉ።',
    om: 'Miseensummaan gaaffii gamaaggamamee hawaasa Edir giddugaleessaa makamuuf dhiyaatu of keessatti qaba. Filannoowwan oomishaa hojii irra jiran armaan gadii bulchitoota EthioLife Edir tiin murtaaʼu; haalota oomishaa fi hayyamaaf saaxilamuu dandaʼu.',
    ti: 'ኣባልነት ናብ ማእከላይ ማሕበረሰብ Edir ንምጽንባር ዝግምገም ሕቶ የጠቓልል። እቶም ኣብ ታሕቲ ዘለዉ ንጡፋት ኣማራጺታት ፍርያት ብምምሕዳራት EthioLife Edir ይውሰኑ፣ ስለዚ ውዕላት ፍርያትን ፍቓድን ከድልዩ ይኽእሉ።',
    so: 'Xubinnimadu waxay ka kooban tahay codsi dib loo eegayo oo lagu biirayo bulshada dhexe ee Edir. Ikhtiyaarrada badeecadaha ee hoose waxaa dejiya maamulayaasha EthioLife Edir, waxaana laga yaabaa inay ku xirnaadaan shuruudo iyo oggolaansho.',
    ar: 'تشمل العضوية طلبًا خاضعًا للمراجعة للانضمام إلى مجتمع إدير المركزي. يحدد مسؤولو EthioLife Edir خيارات المنتجات النشطة أدناه، وقد تخضع لشروط وموافقة.',
    sw: 'Uanachama unajumuisha ombi linalokaguliwa la kujiunga na jumuiya kuu ya Edir. Chaguo za bidhaa zinazotumika hapa chini huwekwa na wasimamizi wa EthioLife Edir na zinaweza kutegemea masharti na idhini.',
  },
  'Community membership and group participation are available after review. No financial products are currently open for enrollment.': {
    am: 'የማኅበረሰብ አባልነትና በቡድን መሳተፍ ከግምገማ በኋላ ይገኛሉ። በአሁኑ ጊዜ ለምዝገባ የተከፈተ የፋይናንስ ምርት የለም።', om: 'Miseensummaan hawaasaa fi hirmaannaan garee gamaaggama booda ni argamu. Yeroo ammaa oomishni faayinaansii galmeessuuf banaa taʼe hin jiru.', ti: 'ኣባልነት ማሕበረሰብን ተሳትፎ ጉጅለን ድሕሪ ግምገማ ይርከቡ። ኣብዚ እዋን ንምዝገባ ዝተኸፍተ ፋይናንሳዊ ፍርያት የለን።', so: 'Xubinnimada bulshada iyo ka qaybgalka kooxdu waxay diyaar yihiin dib-u-eegista ka dib. Hadda ma jiro badeecad maaliyadeed oo diiwaangelin u furan.', ar: 'تتاح عضوية المجتمع والمشاركة في المجموعات بعد المراجعة. لا توجد حاليًا منتجات مالية مفتوحة للتسجيل.', sw: 'Uanachama wa jumuiya na ushiriki wa kikundi hupatikana baada ya ukaguzi. Kwa sasa hakuna bidhaa za kifedha zilizo wazi kwa usajili.',
  },
  'Insurance, lending, and benefit payouts are not currently available through this pilot. Product availability and terms can change as the program is configured.': {
    am: 'በዚህ የሙከራ ፕሮግራም ኢንሹራንስ፣ ብድርና የጥቅም ክፍያዎች በአሁኑ ጊዜ አይገኙም። ፕሮግራሙ ሲዘጋጅ የምርቶቹ መገኘትና ውሎች ሊቀየሩ ይችላሉ።',
    om: 'Inshuraansiin, liqiin fi kaffaltiin faayidaa ammaaf pilootii kanaan hin argaman. Sagantaan yeroo qophaaʼutti argamuun oomishaa fi haalotni isaa jijjiiramuu dandaʼu.',
    ti: 'ኣብዚ ፓይሎት ውሕስነት፣ ልቓሕን ክፍሊት ጥቕምን ኣብዚ እዋን ኣይርከቡን። እቲ ፕሮግራም እናተዳለወ ከሎ ተረኻብነትን ውዕላትን ፍርያት ክቕየሩ ይኽእሉ።',
    so: 'Caymiska, amaahda iyo bixinta faa’iidooyinku hadda lagama heli karo tijaabadan. Helitaanka badeecadaha iyo shuruudahoodu way isbeddeli karaan marka barnaamijka la diyaarinayo.',
    ar: 'لا يتوفر التأمين أو الإقراض أو صرف المزايا حاليًا ضمن هذه المرحلة التجريبية. وقد يتغير توفر المنتجات وشروطها أثناء إعداد البرنامج.',
    sw: 'Bima, mikopo na malipo ya manufaa havipatikani kwa sasa katika jaribio hili. Upatikanaji na masharti ya bidhaa yanaweza kubadilika programu inapoandaliwa.',
  },
  'Your membership is awaiting independent review. No financial activity is enabled.': {
    am: 'አባልነትዎ ገለልተኛ ግምገማን እየጠበቀ ነው። ምንም የፋይናንስ እንቅስቃሴ አልነቃም።', om: 'Miseensummaan keessan gamaaggama bilisaa eeggachaa jira. Sochiin faayinaansii kamiyyuu hin banamne.', ti: 'ኣባልነትኩም ናጻ ግምገማ ይጽበ ኣሎ። ዝኾነ ፋይናንሳዊ ንጥፈት ኣይተነቓቕሐን።', so: 'Xubinnimadaadu waxay sugaysaa dib-u-eegis madax-bannaan. Wax dhaqdhaqaaq maaliyadeed ah lama hawlgelin.', ar: 'عضويتك بانتظار مراجعة مستقلة. لم يتم تفعيل أي نشاط مالي.', sw: 'Uanachama wako unasubiri ukaguzi huru. Hakuna shughuli za kifedha zilizowezeshwa.',
  },
  'You are enrolled in the central EthioLife Edir registry. Your membership does not create a deposit or payment account.': {
    am: 'በማዕከላዊው የEthioLife እድር መዝገብ ተመዝግበዋል። አባልነትዎ የተቀማጭ ወይም የክፍያ መለያ አይፈጥርም።',
    om: 'Galmee Edir giddugaleessaa EthioLife keessatti galmooftaniittu. Miseensummaan keessan herrega kuusaa yookaan kaffaltii hin uumu.',
    ti: 'ኣብ ማእከላይ መዝገብ EthioLife Edir ተመዝጊብኩም ኣለኹም። ኣባልነትኩም ሕሳብ ተቐማጢ ወይ ክፍሊት ኣይፈጥርን።',
    so: 'Waxaad ka diiwaangashan tahay diiwaanka dhexe ee EthioLife Edir. Xubinnimadaadu ma abuureyso akoon deebaaji ama lacag-bixin.',
    ar: 'أنت مسجل في سجل EthioLife Edir المركزي. لا تنشئ عضويتك حساب إيداع أو دفع.',
    sw: 'Umesajiliwa katika sajili kuu ya EthioLife Edir. Uanachama wako haufungui akaunti ya amana au malipo.',
  },
  'Your Edir groups': {
    am: 'የእድር ቡድኖችዎ', om: 'Gareewwan Edir keessan', ti: 'ጉጅለታት Edirኩም', so: 'Kooxahaaga Edir', ar: 'مجموعات إدير الخاصة بك', sw: 'Vikundi vyako vya Edir',
  },
  'You are not assigned to an Edir group yet. Contact an Edir administrator.': {
    am: 'ገና ለእድር ቡድን አልተመደቡም። የእድር አስተዳዳሪን ያነጋግሩ።', om: 'Ammaaf garee Edir keessatti hin ramadamne. Bulchaa Edir qunnamaa.', ti: 'ክሳብ ሕጂ ናብ ጉጅለ Edir ኣይተመደብኩምን። ምምሕዳር Edir ርኸቡ።', so: 'Weli laguma darin koox Edir ah. La xiriir maamulaha Edir.', ar: 'لم يتم تعيينك في مجموعة إدير بعد. تواصل مع مسؤول إدير.', sw: 'Bado hujapangiwa kikundi cha Edir. Wasiliana na msimamizi wa Edir.',
  },
  'No Edir membership requests have been submitted.': {
    am: 'ምንም የእድር አባልነት ጥያቄ አልቀረበም።', om: 'Gaaffiin miseensummaa Edir hin dhiyaanne.', ti: 'ዝኾነ ሕቶ ኣባልነት Edir ኣይቀረበን።', so: 'Wax codsiyo xubinnimo Edir ah lama gudbin.', ar: 'لم يتم تقديم أي طلبات لعضوية إدير.', sw: 'Hakuna maombi ya uanachama wa Edir yaliyowasilishwa.',
  },
  'Umbrella Master Edir management': {
    am: 'የዋናው እድር አስተዳደር', om: 'Bulchiinsa Edir guddaa', ti: 'ምምሕዳር ዋና Edir', so: 'Maamulka Edir-ka dalladda', ar: 'إدارة إدير المظلة', sw: 'Usimamizi wa Edir mwavuli',
  },
  'Onboard independent Edirs and coordinate their operations. Each Edir keeps its own governance, member registry, staff assignments, financial products, and ledger. This dashboard contains cross-Edir totals only.': {
    am: 'ገለልተኛ እድሮችን ያስመዝግቡና ሥራቸውን ያስተባብሩ። እያንዳንዱ እድር የራሱን አስተዳደር፣ የአባላት መዝገብ፣ የሠራተኛ ምደባ፣ የፋይናንስ ምርቶችና ደብተር ይይዛል። ይህ ዳሽቦርድ በእድሮች መካከል ያሉ ጠቅላላ ድምሮችን ብቻ ያሳያል።',
    om: 'Edirwwan of dandaʼan galmeessaa, hojii isaanii qindeessaa. Edir hundi bulchiinsa, galmee miseensotaa, ramaddii hojjettootaa, oomisha faayinaansii fi kitaaba herregaa mataa isaa qaba. Daashboordiin kun idaʼama Edirwwan gidduu jiru qofa agarsiisa.',
    ti: 'Edirwwan bilisa taʼan galmeessaa, hojii isaanii qindeessaa። Edir ነናቱ ምምሕዳር፣ መዝገብ ኣባላት፣ ምደባ ሰራሕተኛታት፣ ፋይናንሳዊ ፍርያትን መዝገብ ሒሳብን ይሕዝ። እዚ ዳሽቦርድ ናይ ኩሎም Edir ጠቕላላ ድምር ጥራይ የርኢ።',
    so: 'Diiwaangeli Edirro madax-bannaan oo isku-dubarid hawlahooda. Edir kasta wuxuu leeyahay maamul, diiwaanka xubnaha, shaqaale loo qoondeeyey, badeecooyin maaliyadeed iyo buug-xisaabeed u gaar ah. Guddigani wuxuu muujinayaa wadarta guud ee Edirrada oo keliya.',
    ar: 'سجّل إديرات مستقلة ونسّق عملياتها. يحتفظ كل إدير بحوكمته وسجل أعضائه وتعيينات موظفيه ومنتجاته المالية ودفتره الخاص. تعرض لوحة المعلومات هذه الإجماليات بين الإديرات فقط.',
    sw: 'Sajili Edir huru na uratibu shughuli zake. Kila Edir ina utawala, sajili ya wanachama, upangaji wa wafanyakazi, bidhaa za kifedha na daftari lake. Dashibodi hii inaonyesha jumla za Edir mbalimbali pekee.',
  },
  'Onboard an independent Edir': {
    am: 'ገለልተኛ እድር ያስመዝግቡ', om: 'Edir of dandaʼe galmeessaa', ti: 'Edir bilisa መዝግቡ', so: 'Diiwaangeli Edir madax-bannaan', ar: 'سجّل إديرًا مستقلًا', sw: 'Sajili Edir huru',
  },
  'Official registration and governance documents must both be verified before approval.': {
    am: 'ከመፍቀድ በፊት ይፋዊ የምዝገባና የአስተዳደር ሰነዶች ሁለቱም መረጋገጥ አለባቸው።', om: 'Hayyama dura sanadoonni galmee mootummaa fi bulchiinsaa lamaan isaanii mirkanaaʼuu qabu.', ti: 'ቅድሚ ምፍቃድ ወግዓዊ ሰነዳት ምዝገባን ምምሕዳርን ክልቲኦም ክረጋገጹ ኣለዎም።', so: 'Dukumentiyada rasmiga ah ee diiwaangelinta iyo maamulka labadaba waa in la xaqiijiyaa ka hor oggolaanshaha.', ar: 'يجب التحقق من وثائق التسجيل والحوكمة الرسمية كلتيهما قبل الموافقة.', sw: 'Hati rasmi za usajili na utawala lazima zithibitishwe zote kabla ya idhini.',
  },
  'Independent Edirs': {
    am: 'ገለልተኛ እድሮች', om: 'Edirwwan of dandaʼan', ti: 'Edirwwan bilisa', so: 'Edirro madax-bannaan', ar: 'إديرات مستقلة', sw: 'Edir huru',
  },
  'Local Edir role': {
    am: 'የአካባቢ እድር ሚና', om: 'Gahee Edir naannoo', ti: 'ሚና ከባቢ Edir', so: 'Doorka Edir maxalliga ah', ar: 'دور إدير المحلي', sw: 'Jukumu la Edir ya eneo',
  },
  'Separate Insurance Edir ledgers and reporting': {
    am: 'የተለዩ የኢንሹራንስ እድር ደብተሮችና ሪፖርት', om: 'Galmeewwan herregaa fi gabaasa Edir inshuraansii adda taʼan', ti: 'ፍሉያት መዝገባት ሒሳብን ሪፖርትን Insurance Edir', so: 'Diiwaannada iyo warbixinta Edir caymiska oo kala gaar ah', ar: 'دفاتر وتقارير إدير التأمين المنفصلة', sw: 'Daftari na ripoti tofauti za Edir ya Bima',
  },
  'Insurance role': {
    am: 'የኢንሹራንስ ሚና', om: 'Gahee inshuraansii', ti: 'ሚና ውሕስነት', so: 'Doorka caymiska', ar: 'دور التأمين', sw: 'Jukumu la bima',
  },
  'Insurance consolidated totals': {
    am: 'የተጠቃለሉ የኢንሹራንስ ድምሮች', om: 'Idaʼama inshuraansii waliigalaa', ti: 'ጠቕላላ ድምር ውሕስነት', so: 'Wadarta guud ee caymiska', ar: 'إجماليات التأمين الموحّدة', sw: 'Jumla za bima zilizounganishwa',
  },
  'Edir administration': {
    am: 'የእድር አስተዳደር', om: 'Bulchiinsa Edir', ti: 'ምምሕዳር Edir', so: 'Maamulka Edir', ar: 'إدارة إدير', sw: 'Usimamizi wa Edir',
  },
  'Review central membership requests, organize community groups, and inspect the append-only Edir audit trail. Money movement requires a separate approver and creates immutable double-entry ledger postings.': {
    am: 'ማዕከላዊ የአባልነት ጥያቄዎችን ይገምግሙ፣ የማኅበረሰብ ቡድኖችን ያደራጁና ተጨማሪ ሊጻፍበት ብቻ የሚችለውን የእድር ኦዲት መዝገብ ይመርምሩ። የገንዘብ እንቅስቃሴ የተለየ አጽዳቂ ይፈልጋል፣ በማይለወጥ ድርብ-ግቤት ደብተርም ይመዘገባል።',
    om: 'Gaaffii miseensummaa giddugaleessaa gamaaggamaa, gareewwan hawaasaa qindeessaa, galmee odiitii Edir irratti dabaluu qofa dandaʼamu ilaalaa. Sochiin maallaqaa nama biraatiin raggaasifamuu qaba; galmee herregaa galmee lamaan hin jijjiiramne keessatti galmaaʼa.',
    ti: 'ማእከላይ ሕቶታት ኣባልነት ግምግሙ፣ ጉጅለታት ማሕበረሰብ ኣዳልዉ፣ እቲ ተወሳኺ ጽሑፍ ጥራይ ዝቕበል መዝገብ ኦዲት Edir ድማ መርምሩ። ምንቅስቓስ ገንዘብ ፍሉይ ኣጽዳቒ ይሓትት፣ ኣብ ዘይቀየር ድርብ መዝገብ ሒሳብ ይምዝገብ።',
    so: 'Dib u eeg codsiyada xubinnimada dhexe, abaabul kooxaha bulshada, oo kormeer diiwaanka hanti-dhawrka Edir ee wax lagu kordhin karo oo keliya. Dhaqdhaqaaqa lacagtu wuxuu u baahan yahay ansixiye kale, waxaana lagu qoraa buug-xisaabeed laba-gelin ah oo aan la beddeli karin.',
    ar: 'راجع طلبات العضوية المركزية ونظّم مجموعات المجتمع وافحص سجل تدقيق إدير الذي يسمح بالإضافة فقط. تتطلب حركة الأموال موافقة شخص آخر، وتُسجّل في دفتر قيود مزدوجة غير قابل للتغيير.',
    sw: 'Kagua maombi ya uanachama ya kati, panga vikundi vya jamii na kagua kumbukumbu ya ukaguzi ya Edir inayoruhusu nyongeza pekee. Uhamishaji wa fedha unahitaji mwidhinishaji tofauti na huandikwa katika daftari lisilobadilika la hesabu za pande mbili.',
  },
  'Create a central Edir group': {
    am: 'ማዕከላዊ የእድር ቡድን ይፍጠሩ', om: 'Garee Edir giddugaleessaa uumaa', ti: 'ማእከላይ ጉጅለ Edir ፍጠሩ', so: 'Abuur koox Edir dhexe ah', ar: 'أنشئ مجموعة إدير مركزية', sw: 'Unda kikundi cha Edir cha kati',
  },
  'Central groups': {
    am: 'ማዕከላዊ ቡድኖች', om: 'Gareewwan giddugaleessaa', ti: 'ማእከላይ ጉጅለታት', so: 'Kooxaha dhexe', ar: 'المجموعات المركزية', sw: 'Vikundi vya kati',
  },
  'No groups have been created.': {
    am: 'ምንም ቡድን አልተፈጠረም።', om: 'Gareen hin uumamne.', ti: 'ዝኾነ ጉጅለ ኣይተፈጥረን።', so: 'Wax kooxo ah lama abuurin.', ar: 'لم يتم إنشاء أي مجموعات.', sw: 'Hakuna vikundi vilivyoundwa.',
  },
  'Assign Edir staff': {
    am: 'የእድር ሠራተኞችን ይመድቡ', om: 'Hojjettoota Edir ramadaa', ti: 'ሰራሕተኛታት Edir ምድቡ', so: 'Qoondee shaqaalaha Edir', ar: 'عيّن موظفي إدير', sw: 'Panga wafanyakazi wa Edir',
  },
  'Edir role': {
    am: 'የእድር ሚና', om: 'Gahee Edir', ti: 'ሚና Edir', so: 'Doorka Edir', ar: 'دور إدير', sw: 'Jukumu la Edir',
  },
  'Edir accounts are not a digital wallet. This view is read-only for your balances and activity; payment and transfer rails are not connected.': {
    am: 'የእድር ሂሳቦች ዲጂታል የገንዘብ ቦርሳ አይደሉም። ይህ እይታ ቀሪ ሂሳብዎንና እንቅስቃሴዎን ለማንበብ ብቻ ነው፤ የክፍያና የዝውውር ሥርዓቶች አልተገናኙም።',
    om: 'Herregni Edir boorsaa maallaqaa dijitaalaa miti. Ilaalchi kun baaqii fi sochii keessan dubbisuuf qofa; sirni kaffaltii fi dabarsaa hin walqabsiifamne.',
    ti: 'ሕሳባት Edir ዲጂታላዊ ቦርሳ ገንዘብ ኣይኮኑን። እዚ ርእይቶ ቀሪ ሒሳብኩምን ንጥፈትኩምን ንምንባብ ጥራይ እዩ፤ መስመራት ክፍሊትን ምትሕልላፍን ኣይተራኸቡን።',
    so: 'Akoonnada Edir ma aha boorsooyin lacag dijitaal ah. Muuqaalkani waa akhris-keliya oo ku saabsan hadhaaga iyo dhaqdhaqaaqa; hababka lacag-bixinta iyo wareejintu iskuma xirna.',
    ar: 'حسابات إدير ليست محفظة رقمية. هذا العرض مخصّص للقراءة فقط للأرصدة والأنشطة؛ ولم يتم ربط قنوات الدفع والتحويل.',
    sw: 'Akaunti za Edir si pochi za kidijitali. Mwonekano huu ni wa kusoma salio na shughuli pekee; mifumo ya malipo na uhamisho haijaunganishwa.',
  },
  'Financial products require independent approval before opening. Deposits and withdrawals post only after a second authorized person approves them. Amounts use ETB; lending and benefit payouts will be introduced as separately controlled stages.': {
    am: 'የፋይናንስ ምርቶች ከመከፈታቸው በፊት ገለልተኛ ፈቃድ ይፈልጋሉ። ተቀማጭና ወጪ ገንዘብ በሁለተኛ የተፈቀደለት ሰው ከጸደቀ በኋላ ብቻ ይመዘገባሉ። መጠኖች በETB ናቸው፤ ብድርና የጥቅም ክፍያዎች በተለያዩ ቁጥጥር ያላቸው ደረጃዎች ይጀምራሉ።',
    om: 'Oomishaaleen faayinaansii banamuu isaanii dura hayyama nama biraa barbaadu. Kuusaa fi baasii maallaqaa nama hayyamame lammaffaan erga raggaasisee booda qofa galmaaʼu. Maallaqni ETB tiin ibsama; liqii fi kaffaltiin faayidaa akka sadarkaa toʼannoo adda addaatti ni jalqabu.',
    ti: 'ፋይናንሳዊ ፍርያት ቅድሚ ምኽፋቱ ናጻ ፍቓድ ይሓትት። ተቐማጢን ወጻኢን ገንዘብ ብካልኣይ ዝተፈቕደሉ ሰብ ድሕሪ ምጽዳቑ ጥራይ ይምዝገቡ። መጠናት ብETB እዮም፤ ልቓሕን ክፍሊት ጥቕምን ከም ብፍሉይ ዝቆጻጸሩ ደረጃታት ክኣትዉ እዮም።',
    so: 'Badeecooyinka maaliyadeed waxay u baahan yihiin oggolaansho madax-bannaan ka hor furitaanka. Dhigashada iyo bixitaanku waxay diiwaangashamaan kaddib marka qof labaad oo la oggolaaday ansixiyo. Lacagaha waxaa lagu muujiyaa ETB; amaahda iyo bixinta faa’iidooyinka waxaa loo soo bandhigi doonaa heerar si gaar ah loo xakameeyo.',
    ar: 'تتطلب المنتجات المالية موافقة مستقلة قبل فتحها. لا تُسجّل الإيداعات والسحوبات إلا بعد موافقة شخص ثانٍ مخوّل. المبالغ بعملة ETB؛ وسيتم طرح الإقراض وصرف المزايا في مراحل منفصلة خاضعة للرقابة.',
    sw: 'Bidhaa za kifedha zinahitaji idhini huru kabla ya kufunguliwa. Amana na utoaji huandikishwa tu baada ya mtu wa pili aliyeidhinishwa kuidhinisha. Kiasi huonyeshwa kwa ETB; mikopo na malipo ya manufaa yataanzishwa katika hatua tofauti zinazodhibitiwa.',
  },
  'No financial products are available yet. An authorized financial manager must propose a product and a different reviewer must approve it.': {
    am: 'እስካሁን ምንም የፋይናንስ ምርት አልተገኘም። የተፈቀደለት የፋይናንስ አስተዳዳሪ ምርት ማቅረብ አለበት፤ ሌላ ገምጋሚም ማጽደቅ አለበት።',
    om: 'Ammaaf oomishni faayinaansii hin jiru. Bulchaan faayinaansii hayyamame oomisha dhiyeessuu qaba; gamaaggamaan biraa immoo raggaasisuu qaba.',
    ti: 'ክሳብ ሕጂ ዝኾነ ፋይናንሳዊ ፍርያት የለን። ዝተፈቕደሉ ሓላፊ ፋይናንስ ፍርያት ከቕርብ ኣለዎ፣ ካልእ ገምጋሚ ድማ ከጽድቖ ኣለዎ።',
    so: 'Weli ma jiraan badeecooyin maaliyadeed. Maamule maaliyadeed oo la oggolaaday waa inuu soo jeediyaa badeecad, qof kale oo dib-u-eegis sameeyaana waa inuu ansixiyaa.',
    ar: 'لا تتوفر منتجات مالية بعد. يجب أن يقترح مدير مالي مخوّل منتجًا وأن يوافق عليه مراجع آخر.',
    sw: 'Bado hakuna bidhaa za kifedha. Meneja wa fedha aliyeidhinishwa lazima apendekeze bidhaa na mkaguzi mwingine aiidhinishe.',
  },
  'You have no Edir financial accounts.': {
    am: 'ምንም የእድር የፋይናንስ ሂሳብ የለዎትም።', om: 'Herrega faayinaansii Edir hin qabdan.', ti: 'ዝኾነ ሕሳብ ፋይናንስ Edir የብልኩምን።', so: 'Ma lihid akoon maaliyadeed oo Edir ah.', ar: 'ليس لديك حسابات مالية لدى إدير.', sw: 'Huna akaunti za kifedha za Edir.',
  },
  'Request a withdrawal': {
    am: 'ወጪ ገንዘብ ይጠይቁ', om: 'Baasii maallaqaa gaafadhaa', ti: 'ወጻኢ ገንዘብ ሕተቱ', so: 'Codso lacag-bixin', ar: 'اطلب سحبًا', sw: 'Omba kutoa fedha',
  },
  'Your detailed Edir transaction activity': {
    am: 'ዝርዝር የእድር ግብይት እንቅስቃሴዎ', om: 'Sochii balʼinaan daldala Edir keessan', ti: 'ዝርዝር ንጥፈት ግብይት Edirኩም', so: 'Faahfaahinta dhaqdhaqaaqa macaamilka Edir', ar: 'تفاصيل معاملات إدير الخاصة بك', sw: 'Shughuli za kina za miamala yako ya Edir',
  },
  'No Edir transaction activity is linked to your membership.': {
    am: 'ከአባልነትዎ ጋር የተያያዘ የእድር ግብይት እንቅስቃሴ የለም።', om: 'Sochiin daldala Edir miseensummaa keessan waliin walqabate hin jiru.', ti: 'ምስ ኣባልነትኩም ዝተኣሳሰረ ንጥፈት ግብይት Edir የለን።', so: 'Ma jiro dhaqdhaqaaq macaamil Edir oo ku xiran xubinnimadaada.', ar: 'لا توجد معاملات إدير مرتبطة بعضويتك.', sw: 'Hakuna shughuli za miamala ya Edir zilizounganishwa na uanachama wako.',
  },
  'Propose a financial product': {
    am: 'የፋይናንስ ምርት ያቅርቡ', om: 'Oomisha faayinaansii dhiyeessaa', ti: 'ፋይናንሳዊ ፍርያት ኣቕርቡ', so: 'Soo jeedi badeecad maaliyadeed', ar: 'اقترح منتجًا ماليًا', sw: 'Pendekeza bidhaa ya kifedha',
  },
  'Product type': {
    am: 'የምርት ዓይነት', om: 'Gosa oomishaa', ti: 'ዓይነት ፍርያት', so: 'Nooca badeecadda', ar: 'نوع المنتج', sw: 'Aina ya bidhaa',
  },
  'Allow withdrawals from this product after independent approval.': {
    am: 'ገለልተኛ ፈቃድ ከተገኘ በኋላ ከዚህ ምርት ገንዘብ ማውጣት ይፍቀዱ።',
    om: 'Erga hayyamni nama biraa argamee booda oomisha kana irraa maallaqa baasuu hayyamaa.',
    ti: 'ናጻ ፍቓድ ምስ ተረኽበ ካብዚ ፍርያት ገንዘብ ክወጽእ ፍቐዱ።',
    so: 'Oggolow in badeecaddan lacag lagala baxo marka ansixin madax-bannaan la helo.',
    ar: 'اسمح بالسحب من هذا المنتج بعد الحصول على موافقة مستقلة.',
    sw: 'Ruhusu kutoa fedha kwenye bidhaa hii baada ya idhini huru.',
  },
  'Entity finance operations': {
    am: 'የድርጅት ፋይናንስ ሥራዎች', om: 'Hojii faayinaansii dhaabbataa', ti: 'ስራሕ ፋይናንስ ትካል', so: 'Hawlaha maaliyadeed ee hay’adda', ar: 'العمليات المالية للكيان', sw: 'Shughuli za kifedha za taasisi',
  },
  'Add customer or vendor': {
    am: 'ደንበኛ ወይም አቅራቢ ያክሉ', om: 'Maamila yookaan dhiyeessaa dabalaa', ti: 'ዓሚል ወይ ኣቕራቢ ወስኹ', so: 'Ku dar macmiil ama alaab-qeybiye', ar: 'أضف عميلًا أو مورّدًا', sw: 'Ongeza mteja au muuzaji',
  },
  'Save contact': {
    am: 'እውቂያውን ያስቀምጡ', om: 'Quunnamtii olkaaʼaa', ti: 'ርክብ ዓቅቡ', so: 'Kaydi xiriirka', ar: 'احفظ جهة الاتصال', sw: 'Hifadhi mawasiliano',
  },
  'Create invoice or bill': {
    am: 'ደረሰኝ ወይም ሂሳብ ይፍጠሩ', om: 'Invooysii yookaan biilii uumaa', ti: 'ኢንቮይስ ወይ ቢል ፍጠሩ', so: 'Abuur qaansheeg ama biil', ar: 'أنشئ فاتورة أو مطالبة', sw: 'Unda ankara au bili',
  },
  'Document line': {
    am: 'የሰነድ መስመር ንጥል', om: 'Sarara sanadaa', ti: 'መስመር ሰነድ', so: 'Qaybta dukumentiga', ar: 'بند المستند', sw: 'Kipengee cha hati',
  },
  'The first version accepts one document line per submission; create separate documents for additional lines.': {
    am: 'የመጀመሪያው ስሪት በአንድ ማስገባት አንድ የሰነድ መስመር ብቻ ይቀበላል፤ ተጨማሪ መስመሮችን ለማስገባት የተለዩ ሰነዶችን ይፍጠሩ።',
    om: 'Jalqabni kun yeroo galchaa tokkootti sarara sanadaa tokko qofa fudhata; sararoota dabalataaf sanadoota adda addaa uumaa.',
    ti: 'እቲ ቀዳማይ ስሪት ኣብ ነፍሲ ወከፍ ምቕራብ ሓደ መስመር ሰነድ ጥራይ ይቕበል፤ ንተወሳኺ መስመራት ፍሉያት ሰነዳት ፍጠሩ።',
    so: 'Nooca koowaad wuxuu aqbalaa hal sadar oo dukumenti ah gudbin kasta; u samee dukumentiyo gaar ah sadar kasta oo dheeraad ah.',
    ar: 'يقبل الإصدار الأول بندًا واحدًا لكل مستند عند الإرسال؛ أنشئ مستندات منفصلة للبنود الإضافية.',
    sw: 'Toleo la kwanza linakubali kipengee kimoja cha hati kwa kila uwasilishaji; unda hati tofauti kwa vipengee vya ziada.',
  },
  'Entity documents': {
    am: 'የድርጅት ሰነዶች', om: 'Sanadoota dhaabbataa', ti: 'ሰነዳት ትካል', so: 'Dukumentiyada hay’adda', ar: 'مستندات الكيان', sw: 'Hati za taasisi',
  },
  'Create monthly budget': {
    am: 'ወርሃዊ በጀት ይፍጠሩ', om: 'Baajata jiʼaa uumaa', ti: 'ወርሓዊ ባጀት ፍጠሩ', so: 'Abuur miisaaniyad bille ah', ar: 'أنشئ ميزانية شهرية', sw: 'Unda bajeti ya kila mwezi',
  },
  'Save draft': {
    am: 'ረቂቅ አስቀምጥ', om: 'Wixinee olkaa’i', ti: 'ረቂቕ ዓቅብ', so: 'Kaydi qabyo-qoraalka', ar: 'احفظ المسودة', sw: 'Hifadhi rasimu',
  },
  'Choose at least one picture to upload.': {
    so: 'Dooro ugu yaraan hal sawir si aad u geliso.', ar: 'اختر صورة واحدة على الأقل لتحميلها.', sw: 'Chagua angalau picha moja ya kupakia.',
  },
  'Save draft budget': {
    am: 'የበጀት ረቂቁን ያስቀምጡ', om: 'Baajata wixinee olkaaʼaa', ti: 'ረቂቕ ባጀት ዓቅቡ', so: 'Kaydi qabyo-qoraalka miisaaniyadda', ar: 'احفظ مسودة الميزانية', sw: 'Hifadhi rasimu ya bajeti',
  },
  'Register entity bank account': {
    am: 'የድርጅቱን የባንክ ሂሳብ ያስመዝግቡ', om: 'Herrega baankii dhaabbataa galmeessaa', ti: 'ሕሳብ ባንኪ ትካል መዝግቡ', so: 'Diiwaangeli akoon bangi oo hay’adeed', ar: 'سجّل الحساب المصرفي للكيان', sw: 'Sajili akaunti ya benki ya taasisi',
  },
  'Save bank account': {
    am: 'የባንክ ሂሳቡን ያስቀምጡ', om: 'Herrega baankii olkaaʼaa', ti: 'ሕሳብ ባንኪ ዓቅቡ', so: 'Kaydi akoonka bangiga', ar: 'احفظ الحساب المصرفي', sw: 'Hifadhi akaunti ya benki',
  },
  'Import bank statement CSV': {
    am: 'የባንክ መግለጫ CSV ያስመጡ', om: 'Ibsa baankii CSV galchaa', ti: 'CSV መግለጺ ባንኪ ኣእትዉ', so: 'Soo geli CSV-ga bayaanka bangiga', ar: 'استورد كشف حساب البنك بصيغة CSV', sw: 'Ingiza taarifa ya benki ya CSV',
  },
  'Import statement': {
    am: 'መግለጫውን ያስመጡ', om: 'Ibsa galchaa', ti: 'መግለጺ ኣእትዉ', so: 'Soo geli bayaanka', ar: 'استورد الكشف', sw: 'Ingiza taarifa',
  },
  'Prepare tax period workpaper': {
    am: 'የግብር ጊዜ የሥራ ሰነድ ያዘጋጁ', om: 'Waraqaa hojii yeroo gibiraa qopheessaa', ti: 'ሰነድ ስራሕ እዋን ግብሪ ኣዳልዉ', so: 'Diyaari waraaqda shaqada ee muddada canshuurta', ar: 'أعد ورقة عمل الفترة الضريبية', sw: 'Andaa karatasi ya kazi ya kipindi cha kodi',
  },
  'Save filing workpaper': {
    am: 'የማስገቢያ የሥራ ሰነዱን ያስቀምጡ', om: 'Waraqaa hojii galchaa olkaaʼaa', ti: 'ሰነድ ስራሕ ምቕራብ ዓቅቡ', so: 'Kaydi waraaqda shaqada ee gudbinta', ar: 'احفظ ورقة عمل الإقرار', sw: 'Hifadhi karatasi ya kazi ya uwasilishaji',
  },
  'Entity reporting basis': {
    am: 'የድርጅት ሪፖርት ማቅረቢያ መሠረት', om: 'Buʼuura gabaasa dhaabbataa', ti: 'መሰረት ሪፖርት ትካል', so: 'Habka warbixinta hay’adda', ar: 'أساس التقارير للكيان', sw: 'Msingi wa taarifa za taasisi',
  },
  'Save reporting basis': {
    am: 'የሪፖርት መሠረቱን ያስቀምጡ', om: 'Buʼuura gabaasaa olkaaʼaa', ti: 'መሰረት ሪፖርት ዓቅቡ', so: 'Kaydi habka warbixinta', ar: 'احفظ أساس التقارير', sw: 'Hifadhi msingi wa taarifa',
  },
  'Accounting & Finance uses the same AfroLife mini-app subscription and payment review as other services. Subscription access is managed from Service subscriptions; this workspace is for accounting standards and books.': {
    am: 'የሂሳብና ፋይናንስ አገልግሎት ከሌሎች አገልግሎቶች ጋር ተመሳሳይ የAfroLife ሚኒ-መተግበሪያ አባልነትና የክፍያ ግምገማ ይጠቀማል። የአባልነት መዳረሻ ከአገልግሎት አባልነቶች ይተዳደራል፤ ይህ የሥራ ቦታ ለሂሳብ ደረጃዎችና መዝገቦች ነው።',
    om: 'Herregnii fi Faayinaansii tajaajiloota biroo wajjin miseensummaa mini-app AfroLife fi gamaaggama kaffaltii walfakkaataa fayyadama. Seensaan miseensummaa Tajaajila Miseensota irraa bulfama; iddoo hojii kun ulaagaalee herregaa fi galmeewwaniif qofa.',
    ti: 'ሒሳብን ፋይናንስን ከም ካልኦት ኣገልግሎታት ተመሳሳሊ ኣባልነት ሚኒ-ኣፕ AfroLifeን ግምገማ ክፍሊትን ይጥቀም። መእተዊ ኣባልነት ካብ ኣባልነት ኣገልግሎታት ይመሓደር፤ እዚ ቦታ ስራሕ ንመለክዒታት ሒሳብን መዝገባትን እዩ።',
    so: 'Xisaabaadka iyo Maaliyaddu waxay isticmaalaan rukhsadda mini-app-ka AfroLife iyo dib-u-eegista lacag-bixinta ee adeegyada kale. Gelitaanka rukhsadda waxaa laga maamulaa Rukhsadaha Adeegga; goobtan shaqadu waxay u gaar tahay halbeegyada xisaabaadka iyo buugaagta.',
    ar: 'يستخدم قسم المحاسبة والمالية اشتراك تطبيق AfroLife المصغّر ومراجعة الدفع نفسيهما المستخدمين في الخدمات الأخرى. تُدار صلاحية الاشتراك من اشتراكات الخدمات؛ ومساحة العمل هذه مخصصة لمعايير المحاسبة ودفاترها.',
    sw: 'Uhasibu na Fedha hutumia usajili huohuo wa programu ndogo ya AfroLife na ukaguzi wa malipo kama huduma nyingine. Ufikiaji wa usajili husimamiwa kwenye Usajili wa Huduma; eneo hili la kazi ni la viwango na vitabu vya uhasibu.',
  },
  'Submit for approval': {
    am: 'ለማጽደቅ ያቅርቡ', om: 'Raggaasiisuuf dhiyeessaa', ti: 'ንምጽዳቕ ኣቕርቡ', so: 'U gudbi ansixin', ar: 'أرسل للموافقة', sw: 'Wasilisha ili kuidhinishwa',
  },
  'Submit payment for review': {
    am: 'ክፍያውን ለግምገማ ያቅርቡ', om: 'Kaffaltii gamaaggamaaf dhiyeessaa', ti: 'ክፍሊት ንግምገማ ኣቕርቡ', so: 'U gudbi lacag-bixinta dib-u-eegis', ar: 'أرسل الدفعة للمراجعة', sw: 'Wasilisha malipo yakaguliwe',
  },
  'Approve budget': {
    am: 'በጀቱን ያጽድቁ', om: 'Baajata raggaasisaa', ti: 'ባጀት ኣጽድቑ', so: 'Ansixi miisaaniyadda', ar: 'اعتمد الميزانية', sw: 'Idhinisha bajeti',
  },
  'Match & reconcile': {
    am: 'ያዛምዱና ያስታርቁ', om: 'Walsimsiisaa fi herrega sirreessaa', ti: 'ኣዛምዱን ኣስማምዑን', so: 'Waafaji oo iswaafaji xisaabaadka', ar: 'طابق وسوِّ الحسابات', sw: 'Linganisha na sawazisha',
  },
  'Simulate test submission (no authority filing)': {
    am: 'የሙከራ ማስገባት አስመስሉ (ለባለሥልጣን አይቀርብም)', om: 'Galchaa yaalii fakkeessaa (qaama mootummaa bira hin gaʼu)', ti: 'ምቕራብ ፈተነ ኣስምስሉ (ናብ በዓል ስልጣን ኣይቀርብን)', so: 'Matala gudbin tijaabo ah (looma gudbinayo hay’ad rasmi ah)', ar: 'حاكِ إرسالًا تجريبيًا (لن يُرسل إلى جهة رسمية)', sw: 'Iga uwasilishaji wa majaribio (haupelekwi kwa mamlaka)',
  },
  'Request information': {
    am: 'መረጃ ይጠይቁ', om: 'Odeeffannoo gaafadhaa', ti: 'ሓበሬታ ሕተቱ', so: 'Codso macluumaad', ar: 'اطلب معلومات', sw: 'Omba maelezo',
  },
  'I consent to AfroLife forwarding this information request to the Insurance service team. This is not an application, policy, quote, or coverage confirmation.': {
    am: 'AfroLife ይህን የመረጃ ጥያቄ ወደ ኢንሹራንስ አገልግሎት ቡድን እንዲያስተላልፍ ተስማምቻለሁ። ይህ ማመልከቻ፣ ፖሊሲ፣ የዋጋ ጥቅስ ወይም የሽፋን ማረጋገጫ አይደለም።',
    om: 'AfroLife gaaffii odeeffannoo kana gara garee tajaajila inshuraansiitti akka dabarsu nan hayyama. Kun iyyata, poolisii, tilmaama gatii yookaan mirkaneessa inshuraansii miti.',
    ti: 'AfroLife እዚ ሕቶ ሓበሬታ ናብ ጉጅለ ኣገልግሎት ውሕስነት ከመሓላልፎ ፈቒደ ኣለኹ። እዚ መመልከቲ፣ ፖሊሲ፣ ጥቕሲ ዋጋ ወይ ምርግጋጽ ሽፋን ኣይኮነን።',
    so: 'Waxaan oggolahay in AfroLife codsigan macluumaadka u gudbiso kooxda adeegga Caymiska. Tani ma aha codsi caymis, caymis la soo saaray, qiime-soo-jeedin ama xaqiijin caymis.',
    ar: 'أوافق على إحالة AfroLife لطلب المعلومات هذا إلى فريق خدمات التأمين. لا يُعد ذلك طلب تأمين أو وثيقة أو عرض سعر أو تأكيدًا للتغطية.',
    sw: 'Ninakubali AfroLife kupeleka ombi hili la maelezo kwa timu ya huduma za Bima. Hili si ombi la bima, sera, makadirio ya bei wala uthibitisho wa bima.',
  },
  'Optional: I consent to sharing my name, phone number, and selected topic with one assigned AfroLife Agent for non-binding follow-up and referral to the Insurance service team. The Agent cannot advise, quote, collect premiums, submit applications, or influence underwriting or claims.': {
    am: 'አማራጭ፦ ስሜን፣ ስልክ ቁጥሬንና የመረጥኩትን ርዕስ ለአንድ የተመደበ የAfroLife ወኪል ለማጋራት ተስማምቻለሁ፤ ወኪሉ የማያስገድድ ክትትል ያደርጋልና ወደ ኢንሹራንስ አገልግሎት ቡድን ይመራል። ወኪሉ ምክር መስጠት፣ ዋጋ መጥቀስ፣ ፕሪሚየም መሰብሰብ፣ ማመልከቻ ማቅረብ ወይም በአደጋ ግምገማና በካሳ ውሳኔ ላይ ተጽዕኖ ማድረግ አይችልም።',
    om: 'Filannoo: Maqaa, lakkoofsa bilbilaa fi mata-duree filattan bakka buʼaa AfroLife tokkoof akka qoodamu nan hayyama; inni hordoffii dirqama hin taane godhee gara garee inshuraansiitti isin qajeelcha. Bakka buʼaan gorsa, tilmaama gatii, walitti qabaa kaffaltii, dhiyeessa iyyataa yookaan murtii madaallii balaa fi gaaffii beenyaa irratti dhiibbaa gochuu hin dandaʼu.',
    ti: 'ኣማራጺ፦ ስመይ፣ ቁጽሪ ስልከይን ዝመረጽክዎ ኣርእስትን ምስ ሓደ ዝተመደበ ወኪል AfroLife ክካፈል ፈቒደ ኣለኹ፤ እቲ ወኪል ዘይግድን ክትትል ገይሩ ናብ ጉጅለ ኣገልግሎት ውሕስነት ይመርሕ። ወኪል ምኽሪ፣ ጥቕሲ ዋጋ፣ ምእካብ ፕሪሚየም፣ ምቕራብ መመልከቲ ወይ ኣብ ግምገማ ስግኣትን ውሳነ ካሕሳን ጽልዋ ምግባር ኣይክእልን።',
    so: 'Ikhtiyaari: Waxaan oggolahay in magacayga, lambarka telefoonka iyo mawduuca aan doortay lala wadaago hal Wakiil AfroLife oo la ii qoondeeyey si uu dabagal aan khasab ahayn u sameeyo iiguna gudbiyo kooxda adeegga Caymiska. Wakiilku ma bixin karo talo ama qiime, mana qaadi karo khidmad, gudbin karo codsi ama saamayn ku yeelan karo qiimaynta khatarta ama go’aamada sheegashada.',
    ar: 'اختياري: أوافق على مشاركة اسمي ورقم هاتفي والموضوع الذي اخترته مع وكيل واحد معيّن من AfroLife للمتابعة غير الملزمة وإحالتي إلى فريق خدمات التأمين. لا يجوز للوكيل تقديم المشورة أو عرض سعر أو تحصيل أقساط أو تقديم طلبات أو التأثير في الاكتتاب أو المطالبات.',
    sw: 'Hiari: Ninakubali jina langu, nambari yangu ya simu na mada niliyochagua kushirikiwa na Wakala mmoja wa AfroLife niliyekabidhiwa kwa ufuatiliaji usio wa lazima na kuelekezwa kwa timu ya huduma za Bima. Wakala haruhusiwi kutoa ushauri au bei, kukusanya ada, kutuma maombi, au kuathiri tathmini ya hatari au madai.',
  },
  'Your requests and activity': {
    am: 'ጥያቄዎችዎና እንቅስቃሴዎ', om: 'Gaaffii fi sochii keessan', ti: 'ሕቶታትኩምን ንጥፈታትኩምን', so: 'Codsiyadaada iyo dhaqdhaqaaqaaga', ar: 'طلباتك ونشاطك', sw: 'Maombi na shughuli zako',
  },
  'No Insurance information requests are linked to your account.': {
    am: 'ከመለያዎ ጋር የተያያዘ የኢንሹራንስ መረጃ ጥያቄ የለም።', om: 'Gaaffiin odeeffannoo inshuraansii herrega keessan waliin walqabate hin jiru.', ti: 'ምስ ሕሳብኩም ዝተኣሳሰረ ሕቶ ሓበሬታ ውሕስነት የለን።', so: 'Ma jiro codsi macluumaad caymis oo ku xiran akoonkaaga.', ar: 'لا توجد طلبات معلومات تأمين مرتبطة بحسابك.', sw: 'Hakuna maombi ya maelezo ya bima yaliyounganishwa na akaunti yako.',
  },
  'Consent-based Agent referrals': {
    am: 'በፈቃድ የሚደረጉ የወኪል ሪፈራሎች', om: 'Ergaa bakka buʼaa hayyama irratti hundaaʼe', ti: 'ምምራሕ ወኪል ብፍቓድ', so: 'Gudbin wakiil oo oggolaansho ku salaysan', ar: 'إحالات الوكلاء بموافقة العميل', sw: 'Rufaa za mawakala kwa ridhaa',
  },
  'No consented Insurance referrals are assigned in your Agent scope.': {
    am: 'በወኪል ሚናዎ የተመደበ የተፈቀደ የኢንሹራንስ ሪፈራል የለም።', om: 'Gahee bakka buʼaa keessan keessatti ergaan inshuraansii hayyamame hin ramadamne.', ti: 'ኣብ ሚና ወኪልኩም ፍቓድ ዝረኸበ ምምራሕ ውሕስነት ኣይተመደበን።', so: 'Ma jiro gudbin caymis oo oggolaansho leh oo laguugu qoondeeyey doorka wakiilkaaga.', ar: 'لا توجد إحالات تأمين بموافقة العميل ضمن نطاق عملك كوكيل.', sw: 'Hakuna rufaa ya bima iliyoidhinishwa iliyokabidhiwa katika jukumu lako la uwakala.',
  },
  'Brokerage lifecycle training sandbox': {
    am: 'የኢንሹራንስ ደላላ የሥራ ዑደት ሥልጠና ማስመሰያ', om: 'Fakkeessaa leenjii marsaa hojii daldala inshuraansii', ti: 'ማሰልጠኒ ሞዴል ዑደት ስራሕ ደላላ ውሕስነት', so: 'Jawi tababarka wareegga shaqada ee dilaalka caymiska', ar: 'بيئة تدريب محاكاة لدورة عمل وساطة التأمين', sw: 'Mazingira ya mafunzo ya mzunguko wa shughuli za udalali wa bima',
  },
  'Development-only simulated workflow using synthetic product and transaction data. It cannot contact insurers, issue real policies, move money, settle commissions, or decide real claims.': {
    am: 'ለልማት ብቻ የተዘጋጀ የሙከራ ሥራ ሂደት ነው፤ ሰው ሠራሽ የምርትና የግብይት መረጃ ይጠቀማል። ከኢንሹራንስ ድርጅቶች ጋር መገናኘት፣ እውነተኛ ፖሊሲ ማውጣት፣ ገንዘብ ማንቀሳቀስ፣ ኮሚሽን ማጠናቀቅ ወይም ትክክለኛ የካሳ ጥያቄ መወሰን አይችልም።',
    om: 'Adeemsi kun misoomaaf qofa yaalii taasifame; odeeffannoo oomishaa fi daldalaa nam-tolchee fayyadama. Dhaabbata inshuraansii qunnamuu, poolisii dhugaa baasuu, maallaqa sochoosuu, koomishinii xumuru yookaan gaafii beenyaa dhugaa irratti murteessuu hin dandaʼu.',
    ti: 'እዚ ንምምዕባል ጥራይ ዝተዳለወ ዝተመስለ መስርሕ እዩ፤ ሰብ ሰራሕ ሓበሬታ ፍርያትን ግብይትን ይጥቀም። ምስ ኢንሹራንስ ምርኻብ፣ ናይ ሓቂ ፖሊሲ ምውጻእ፣ ገንዘብ ምንቅስቓስ፣ ኮሚሽን ምጽራይ ወይ ናይ ሓቂ ክሲ ምውሳን ኣይክእልን።',
    so: 'Hab-socodkan la matalayey waxaa loogu talagalay horumarinta oo keliya, wuxuuna adeegsadaa xog badeecad iyo macaamil oo la sameeyey. Lama xiriiri karo shirkadaha caymiska, ma soo saari karo caymis dhab ah, ma dhaqaajin karo lacag, ma xallin karo guddiyo, mana go’aamin karo sheegashooyin dhab ah.',
    ar: 'هذا سير عمل محاكى للتطوير فقط ويستخدم بيانات اصطناعية للمنتجات والمعاملات. لا يمكنه الاتصال بشركات التأمين أو إصدار وثائق حقيقية أو تحويل الأموال أو تسوية العمولات أو البت في مطالبات حقيقية.',
    sw: 'Mtiririko huu wa majaribio ni wa maendeleo pekee na hutumia data ghushi ya bidhaa na miamala. Hauwezi kuwasiliana na bima, kutoa sera halisi, kuhamisha fedha, kulipa kamisheni au kuamua madai halisi.',
  },
  'I confirm that this scenario uses no real customer, policy, payment, or claims data.': {
    am: 'ይህ ሁኔታ እውነተኛ የደንበኛ፣ የፖሊሲ፣ የክፍያ ወይም የካሳ ጥያቄ መረጃ እንደማይጠቀም አረጋግጣለሁ።', om: 'Haalli kun odeeffannoo maamilaa, poolisii, kaffaltii yookaan gaafii beenyaa dhugaa akka hin fayyadamne nan mirkaneessa.', ti: 'እዚ ኩነታት ናይ ሓቂ ሓበሬታ ዓሚል፣ ፖሊሲ፣ ክፍሊት ወይ ክሲ ከም ዘይጥቀም አረጋግጽ።', so: 'Waxaan xaqiijinayaa in xaaladdani aysan adeegsanayn xog dhab ah oo macaamiil, caymis, lacag-bixin ama sheegasho ah.', ar: 'أؤكد أن هذا السيناريو لا يستخدم أي بيانات حقيقية للعملاء أو الوثائق أو المدفوعات أو المطالبات.', sw: 'Ninathibitisha kuwa hali hii haitumii data halisi ya mteja, sera, malipo au madai.',
  },
  'Edir credit policy and loan requests': {
    am: 'የእድር የብድር ፖሊሲና የብድር ጥያቄዎች', om: 'Imaammata liqaa Edir fi gaaffii liqaa', ti: 'ፖሊሲ ልቓሕ Edirን ሕቶታት ልቓሕን', so: 'Siyaasadda amaahda Edir iyo codsiyada amaahda', ar: 'سياسة إدير الائتمانية وطلبات القروض', sw: 'Sera ya mikopo ya Edir na maombi ya mkopo',
  },
  'Each Edir proposes and independently approves its own versioned credit policy. Loan offers are interest-free and fee-free; member acceptance selects an active savings account, followed by separately approved savings-account disbursement and savings-funded principal repayments. Cash, mobile-wallet, and third-party payouts are later stages and are not simulated.': {
    am: 'እያንዳንዱ እድር የራሱን በስሪት የተመዘገበ የብድር ፖሊሲ ያቀርባልና በተለየ ሂደት ያጸድቃል። ብድሮቹ ወለድና ክፍያ የላቸውም። አባሉ ሲቀበል ንቁ የቁጠባ ሂሳብ ይመርጣል፤ ብድሩ ለየት ባለ ፈቃድ በዚያ ሂሳብ ይከፈላል፣ ዋናውም ገንዘብ ከቁጠባው ተመልሶ ይከፈላል። በጥሬ ገንዘብ፣ በሞባይል ቦርሳ ወይም በሶስተኛ ወገን የሚፈጸሙ ክፍያዎች የወደፊት ደረጃዎች ናቸው፤ በዚህ ማስመሰያ አይካተቱም።',
    om: 'Edir hundi imaammata liqaa mataa isaa isa fooyyaʼiinsaan galmaaʼe dhiyeessee of dandaʼee raggaasisa. Liqiin dhala fi kaffaltii hin qabu. Miseensi yeroo fudhatu herrega qusannoo hojii irra jiru filata; erga adda baafamee raggaasifamee booda liqiin herrega qusannoo sana keessatti galmaaʼa, maallaqni buʼuuraas qusannoo irraa deebifama. Kaffaltiin maallaqa callaa, boorsaa bilbilaa yookaan qaama sadaffaa karaa itti aanu ti; as keessatti hin fakkeeffamu.',
    ti: 'ነፍሲ ወከፍ Edir ናይ ገዛእ ርእሱ ብስሪት ዝተመዝገበ ፖሊሲ ልቓሕ የቕርብን ብናጻ የጽድቕን። እቶም ልቓሓት ወለድን ክፍሊትን የብሎምን። ኣባል ምስ ተቐበሎ ንጡፍ ሕሳብ ዕቋር ይመርጽ፤ ልቓሕ ብፍሉይ ምጽዳቕ ናብቲ ሕሳብ ይኣቱ፣ ዋና ገንዘብ ድማ ካብ ዕቋር ይምለስ። ብጥረ ገንዘብ፣ ብሞባይል ቦርሳ ወይ ብሳልሳይ ወገን ዝፍጸም ክፍሊት ናይ ዝቕጽል ደረጃታት እዩ፣ ኣብዚ ኣይምሰልን።',
    so: 'Edir kastaa wuxuu soo jeediyaa oo si madax-bannaan u ansixiyaa siyaasaddiisa amaahda ee noocaysan. Amaahdu dulsaar iyo khidmad midna ma laha. Marka xubintu aqbasho waxay doorataa akoon kayd firfircoon; amaahda waxaa akoonkaas loogu shubaa oggolaansho gaar ah kaddib, raasamaalkana waxaa laga bixiyaa kaydka. Lacag caddaan ah, boorso moobil iyo lacag-bixin dhinac saddexaad waa heerar dambe mana aha kuwo halkan lagu matalo.',
    ar: 'يقترح كل إدير سياسة ائتمانية خاصة به بإصدارات موثقة ويعتمدها بشكل مستقل. القروض بلا فوائد أو رسوم. عند قبول العضو يختار حساب ادخار نشطًا؛ ثم يُصرف القرض إلى الحساب بعد موافقة منفصلة، ويُسدّد أصل المبلغ من المدخرات. الصرف النقدي أو عبر محفظة الهاتف أو طرف ثالث مراحل لاحقة ولا تحاكيها هذه البيئة.',
    sw: 'Kila Edir hupendekeza na kuidhinisha kwa uhuru sera yake ya mikopo yenye matoleo yaliyorekodiwa. Mikopo haina riba wala ada. Mwanachama akikubali huchagua akaunti hai ya akiba; fedha za mkopo huwekwa kwenye akaunti hiyo baada ya idhini tofauti na mtaji hurejeshwa kutoka akiba. Malipo ya pesa taslimu, pochi ya simu au wahusika wengine ni hatua za baadaye na haziigiwi hapa.',
  },
  'Platform-wide daily disbursement limits': {
    am: 'የመድረኩ አጠቃላይ ዕለታዊ የብድር ክፍያ ገደቦች', om: 'Daangaa waliigalaa guyyaa guyyaa kaffaltii liqaa', ti: 'ጠቕላላ መድረኽ ዕለታዊ ደረት ምኽፋል ልቓሕ', so: 'Xadka guud ee maalinlaha ah ee bixinta amaahda', ar: 'الحدود اليومية لصرف القروض على مستوى المنصة', sw: 'Vikomo vya jumla vya kila siku vya utoaji wa mikopo',
  },
  'This maker-checker control caps total posted Edir loan disbursements across all independent Edirs. Per-Edir limits remain active as additional controls.': {
    am: 'ይህ የአዘጋጅና የአጽዳቂ ቁጥጥር በሁሉም ገለልተኛ እድሮች የተመዘገበውን ጠቅላላ ዕለታዊ የብድር ክፍያ ይገድባል። ለእያንዳንዱ እድር የተቀመጡ ገደቦችም እንደ ተጨማሪ ቁጥጥር ይቀጥላሉ።',
    om: 'Toʼannoon qopheessaa fi raggaasisaa kun waliigala kaffaltii liqaa Edir kan galmaaʼe Edirwwan bilisa hundarra jiru daangessa. Daangaawwan Edir tokkoon tokkoo immoo toʼannoo dabalataatti hojii irra turu.',
    ti: 'እዚ ቁጽጽር ኣዳላውን ኣጽዳቕን ኣብ ኩሎም ናጻ Edir ዝተመዝገበ ጠቕላላ ክፍሊት ልቓሕ ይድርት። ንነፍሲ ወከፍ Edir ዝተቐመጡ ደረታት ከም ተወሳኺ ቁጽጽር ንጡፋት ይኾኑ።',
    so: 'Xakamayntan diyaarinta iyo hubinta waxay xaddidaysaa wadarta maalinlaha ah ee amaahda Edir ee dhammaan Edirrada madax-bannaan. Xadka Edir kasta wuu sii shaqaynayaa isagoo ah xakamayn dheeraad ah.',
    ar: 'يضع نظام الإعداد والمراجعة هذا حدًا لإجمالي قروض إدير المصروفة والمسجلة عبر جميع الإديرات المستقلة. وتظل حدود كل إدير ساريةً كضوابط إضافية.',
    sw: 'Udhibiti huu wa mtayarishaji na mkaguzi huweka kikomo cha jumla ya mikopo ya Edir iliyotolewa na kurekodiwa katika Edir zote huru. Vikomo vya kila Edir vinaendelea kutumika kama udhibiti wa ziada.',
  },
  'No platform-wide cap is active.': {
    am: 'በመድረኩ ሁሉ ላይ የሚሠራ ገደብ የለም።', om: 'Daangaan waltajjii guutuu hojii irra jiru hin jiru.', ti: 'ኣብ ምሉእ መድረኽ ንጡፍ ደረት የለን።', so: 'Ma jiro xad guud oo madashu hadda shaqaynaya.', ar: 'لا يوجد حد أقصى فعّال على مستوى المنصة.', sw: 'Hakuna kikomo cha jumla cha jukwaa kinachotumika sasa.',
  },
  'Credit policy versions': {
    am: 'የብድር ፖሊሲ ስሪቶች', om: 'Fooyyaʼiinsa imaammata liqaa', ti: 'ስሪታት ፖሊሲ ልቓሕ', so: 'Noocyada siyaasadda amaahda', ar: 'إصدارات سياسة الائتمان', sw: 'Matoleo ya sera ya mikopo',
  },
  'No policy is approved. Loan applications cannot be underwritten until this Edir approves its own policy.': {
    am: 'ምንም ፖሊሲ አልጸደቀም። ይህ እድር የራሱን ፖሊሲ እስኪያጸድቅ ድረስ የብድር ማመልከቻዎች በአደጋ ምዘና ሊገመገሙ አይችሉም።',
    om: 'Imaammanni hin raggaasifamne. Edir kun imaammata mataa isaa hanga raggaasisutti iyyanni liqaa madaallii balaa irratti hundaaʼee hin ilaalamu.',
    ti: 'ዝኾነ ፖሊሲ ኣይጸደቐን። እዚ Edir ናይ ገዛእ ርእሱ ፖሊሲ ክሳብ ዘጽድቕ፣ መመልከቲ ልቓሕ ብግምገማ ስግኣት ኣይምርመርን።',
    so: 'Siyaasad lama ansixin. Codsiyada amaahda lama qiimayn karo ilaa Edir-kan uu ansixiyo siyaasaddiisa.',
    ar: 'لم تُعتمد أي سياسة. لا يمكن تقييم طلبات القروض ائتمانيًا حتى يعتمد هذا الإدير سياسته الخاصة.',
    sw: 'Hakuna sera iliyoidhinishwa. Maombi ya mkopo hayawezi kutathminiwa hadi Edir hii iidhinishe sera yake.',
  },
  'Propose this Edir’s credit policy': {
    am: 'የዚህን እድር የብድር ፖሊሲ ያቅርቡ', om: 'Imaammata liqaa Edir kanaa dhiyeessaa', ti: 'ፖሊሲ ልቓሕ ናይዚ Edir ኣቕርቡ', so: 'Soo jeedi siyaasadda amaahda ee Edir-kan', ar: 'اقترح سياسة الائتمان الخاصة بهذا الإدير', sw: 'Pendekeza sera ya mikopo ya Edir hii',
  },
  'Weights must add up to 100. Interest and fees are locked at 0. Disbursement and repayment use the separately reviewed savings-account workflow.': {
    am: 'የመመዘኛ ነጥቦቹ ድምር 100 መሆን አለበት። ወለድና ክፍያ በ0 ተቆልፈዋል። የብድር ክፍያና መመለስ በተለየ የቁጠባ ሂሳብ ሂደት ይከናወናሉ።',
    om: 'Ulfaatinni waliigalaa 100 taʼuu qaba. Dhaltii fi kaffaltiin 0 irratti cufamaniiru. Kaffaltii liqaa fi deebiin isaa adeemsa herrega qusannoo adda baafamee gamaaggamame fayyadamu.',
    ti: 'Ulfaatinni waliigalaa 100 ክኸውን ኣለዎ። ወለድን ክፍሊትን ኣብ 0 ተቆሊፎም ኣለዉ። ምኽፋልን ምምላስን ልቓሕ በቲ ብፍሉይ ዝተገምገመ ስርዓት ሕሳብ ዕቋር ይካየዱ።',
    so: 'Miisaannadu waa inay isu geeyaan 100. Dulsaarka iyo khidmadaha waxaa lagu xaddiday 0. Bixinta amaahda iyo dib-u-bixinteedu waxay maraan habka koontada kaydka ee si gaar ah loo eegay.',
    ar: 'يجب أن يكون مجموع الأوزان 100. الفوائد والرسوم مضبوطة على صفر. يتم الصرف والسداد عبر إجراءات حساب الادخار التي تخضع لمراجعة منفصلة.',
    sw: 'Jumla ya uzani lazima iwe 100. Riba na ada zimefungwa kuwa 0. Utoaji na urejeshaji wa mkopo hutumia utaratibu wa akaunti ya akiba uliokaguliwa kando.',
  },
  'No identity or loan documents uploaded yet.': {
    am: 'እስካሁን ምንም የመታወቂያ ወይም የብድር ሰነድ አልተጫነም።', om: 'Sanadni eenyummaa yookaan liqaa ammaaf hin olkaaʼamne.', ti: 'ክሳብ ሕጂ ዝኾነ ሰነድ መንነት ወይ ልቓሕ ኣይተጸዓነን።', so: 'Weli lama soo gelin dukumenti aqoonsi ama amaah.', ar: 'لم يتم رفع أي مستندات هوية أو قرض بعد.', sw: 'Bado hakuna hati za utambulisho au mkopo zilizopakiwa.',
  },
  'Request a loan assessment': {
    am: 'የብድር ግምገማ ይጠይቁ', om: 'Madaallii liqaa gaafadhaa', ti: 'ግምገማ ልቓሕ ሕተቱ', so: 'Codso qiimaynta amaahda', ar: 'اطلب تقييمًا للقرض', sw: 'Omba tathmini ya mkopo',
  },
  'Loan requests are unavailable until an independent reviewer verifies your national ID and KYC documents.': {
    am: 'ገለልተኛ ገምጋሚ ብሔራዊ መታወቂያዎንና የKYC ሰነዶችዎን እስኪያረጋግጥ ድረስ የብድር ጥያቄ ማቅረብ አይቻልም።',
    om: 'Gamaaggamaan bilisaa eenyummaa biyyaalessaa fi sanadoota KYC keessan hanga mirkaneessutti gaaffii liqaa dhiyeessuun hin dandaʼamu.',
    ti: 'Gamaaggamaan naqa ID biyyaalessaa fi sanadoota KYCኹም ክሳብ ዘረጋግጽ ሕቶ ልቓሕ ምቕራብ ኣይከኣልን።',
    so: 'Codsiyada amaahdu lama heli karo ilaa dib-u-eegaha madaxa-bannaan uu xaqiijiyo aqoonsigaaga qaranka iyo dukumentiyada KYC.',
    ar: 'لا تتاح طلبات القروض حتى يتحقق مراجع مستقل من هويتك الوطنية ومستندات KYC.',
    sw: 'Maombi ya mkopo hayapatikani hadi mkaguzi huru athibitishe kitambulisho chako cha taifa na hati za KYC.',
  },
  'Active Edir membership is required to request a loan assessment.': {
    am: 'የብድር ግምገማ ለመጠየቅ ንቁ የእድር አባልነት ያስፈልጋል።', om: 'Madaallii liqaa gaafachuuf miseensummaan Edir hojii irra jiru barbaachisa.', ti: 'ግምገማ ልቓሕ ንምሕታት ንጡፍ ኣባልነት Edir የድሊ።', so: 'Si aad u codsato qiimaynta amaahda waa inaad xubin firfircoon ka tahay Edir.', ar: 'يشترط وجود عضوية نشطة في إدير لطلب تقييم القرض.', sw: 'Unahitaji uanachama hai wa Edir ili kuomba tathmini ya mkopo.',
  },
  'Your loan requests': {
    am: 'የብድር ጥያቄዎችዎ', om: 'Gaaffiiwwan liqaa keessan', ti: 'ሕቶታት ልቓሕኩም', so: 'Codsiyadaada amaahda', ar: 'طلبات القروض الخاصة بك', sw: 'Maombi yako ya mkopo',
  },
  'You have no Edir credit requests.': {
    am: 'ምንም የእድር ብድር ጥያቄ የለዎትም።', om: 'Gaaffii liqaa Edir hin qabdan.', ti: 'ዝኾነ ሕቶ ልቓሕ Edir የብልኩምን።', so: 'Ma lihid codsiyo amaah Edir ah.', ar: 'ليس لديك طلبات ائتمان لدى إدير.', sw: 'Huna maombi ya mkopo ya Edir.',
  },
  'Select an active savings account': {
    am: 'ንቁ የቁጠባ ሂሳብ ይምረጡ', om: 'Herrega qusannoo hojii irra jiru filadhaa', ti: 'ንጡፍ ሕሳብ ዕቋር ምረጹ', so: 'Dooro akoon kayd oo firfircoon', ar: 'اختر حساب ادخار نشطًا', sw: 'Chagua akaunti hai ya akiba',
  },
  'I accept the interest-free, fee-free principal-only loan and savings-account payout terms.': {
    am: 'ወለድና ክፍያ የሌለውን፣ ዋናውን ገንዘብ ብቻ የሚከፍለውን ብድርና ወደ ቁጠባ ሂሳብ የሚገባበትን ውል ተቀብያለሁ።',
    om: 'Liqaa dhala fi kaffaltii hin qabne, maallaqa buʼuuraa qofa kaffaluu fi gara herrega qusannoo galuu isaa nan fudhadha.',
    ti: 'ወለድን ክፍሊትን ዘይብሉ፣ ዋና ገንዘብ ጥራይ ዝሓትትን ናብ ሕሳብ ዕቋር ዝኣቱን ውዕል ተቐቢለ ኣለኹ።',
    so: 'Waxaan aqbalayaa shuruudaha amaah aan dulsaar iyo khidmad lahayn oo raasamaalka oo keliya la bixinayo, laguna shubayo akoon kayd.',
    ar: 'أوافق على شروط القرض الخالي من الفوائد والرسوم، الذي يقتصر سداده على أصل المبلغ ويُصرف إلى حساب ادخار.',
    sw: 'Ninakubali masharti ya mkopo usio na riba wala ada, unaohitaji kurejesha mtaji pekee na kulipwa kupitia akaunti ya akiba.',
  },
  'Enter the API server address first.': {
    am: 'መጀመሪያ የAPI አገልጋይ አድራሻውን ያስገቡ።', om: 'Jalqaba teessoo sarvarii API galchaa.', ti: 'መጀመርታ ኣድራሻ ሰርቨር API ኣእትዉ።', so: 'Marka hore geli cinwaanka adeegaha API-ga.', ar: 'أدخل عنوان خادم API أولًا.', sw: 'Kwanza weka anwani ya seva ya API.',
  },
  'Enter a valid number.': {
    am: 'ትክክለኛ ቁጥር ያስገቡ።', om: 'Lakkoofsa sirrii galchaa.', ti: 'ቅኑዕ ቁጽሪ ኣእትዉ።', so: 'Geli lambar sax ah.', ar: 'أدخل رقمًا صحيحًا.', sw: 'Weka nambari halali.',
  },
  'Enter the six-digit code from your authenticator app.': {
    am: 'ከማረጋገጫ መተግበሪያዎ የስድስት አሃዝ ኮድ ያስገቡ።', om: 'Appii mirkaneessaa keessan irraa koodii lakkoofsa jaʼaa galchaa.', ti: 'ካብ መተግበሪ መረጋገጺኹም ናይ ሽዱሽተ ኣሃዝ ኮድ ኣእትዉ።', so: 'Geli koodhka lixda lambar ah ee ku jira abka xaqiijinta.', ar: 'أدخل الرمز المكوّن من ستة أرقام من تطبيق المصادقة.', sw: 'Weka msimbo wa tarakimu sita kutoka kwenye programu yako ya uthibitishaji.',
  },
  'A registration is already pending. Upload the required documents to finish it.': {
    am: 'ምዝገባ በሂደት ላይ አለ። ለማጠናቀቅ የሚፈለጉትን ሰነዶች ይጫኑ።', om: 'Galmeen tokko duraan adeemsarra jira. Xumuruuf sanadoota barbaachisan olkaaʼaa.', ti: 'ሓደ ምዝገባ ኣብ ምክያድ ኣሎ። ንምዝዛም ዝድለዩ ሰነዳት ጽዓኑ።', so: 'Diiwaangelin ayaa hore u sugaysa. Soo geli dukumentiyada loo baahan yahay si aad u dhammaystirto.', ar: 'يوجد طلب تسجيل قيد الانتظار بالفعل. ارفع المستندات المطلوبة لإكماله.', sw: 'Usajili unasubiriwa tayari. Pakia hati zinazohitajika ili kuukamilisha.',
  },
  'Password confirmation does not match.': {
    am: 'የይለፍ ቃል ማረጋገጫው አይዛመድም።', om: 'Mirkaneessi jecha icciitii wal hin simu.', ti: 'ምርግጋጽ መሕለፊ ቃል ኣይሰማማዕን።', so: 'Xaqiijinta erayga sirta ahi isma waafaqsana.', ar: 'تأكيد كلمة المرور غير مطابق.', sw: 'Uthibitisho wa nenosiri haulingani.',
  },
  'Select each required KYC document before submitting.': {
    am: 'ከማስገባትዎ በፊት እያንዳንዱን የሚፈለግ የKYC ሰነድ ይምረጡ።', om: 'Dura erguu sanada KYC barbaachisu hunda filadhaa.', ti: 'ቅድሚ ምቕራብ ነፍሲ ወከፍ ዝድለ ሰነድ KYC ምረጹ።', so: 'Dooro dhammaan dukumentiyada KYC ee loo baahan yahay ka hor gudbinta.', ar: 'اختر كل مستندات KYC المطلوبة قبل الإرسال.', sw: 'Chagua kila hati ya KYC inayohitajika kabla ya kuwasilisha.',
  },
  'Registration succeeded but a secure document-upload token was not issued. Contact AfroLife support.': {
    am: 'ምዝገባው ተሳክቷል፣ ግን ደህንነቱ የተጠበቀ የሰነድ መጫኛ ቶከን አልተሰጠም። የAfroLife ድጋፍን ያነጋግሩ።',
    om: 'Galmeen milkaaʼeera; garuu mallattoon nageenyaa sanada olkaaʼu hin kennamne. Deeggarsa AfroLife qunnamaa.',
    ti: 'ምዝገባ ተሳኺዑ፣ ግን ውሑስ ምልክት ምጽዓን ሰነድ ኣይተዋህበን። ደገፍ AfroLife ርኸቡ።',
    so: 'Diiwaangelintu way guulaysatay, balse lama bixin summaddii amniga ee dukumentiga lagu gelin lahaa. La xiriir taageerada AfroLife.',
    ar: 'نجح التسجيل، لكن لم يصدر رمز آمن لرفع المستندات. تواصل مع دعم AfroLife.',
    sw: 'Usajili umefaulu, lakini tokeni salama ya kupakia hati haikutolewa. Wasiliana na usaidizi wa AfroLife.',
  },
  'Use a valid HTTPS server URL. HTTP is allowed only for localhost development.': {
    am: 'ትክክለኛ የHTTPS አገልጋይ URL ይጠቀሙ። HTTP የሚፈቀደው ለlocalhost ልማት ብቻ ነው።',
    om: 'URL sarvarii HTTPS sirrii fayyadamaa. HTTP kan hayyamamu localhost irratti yeroo misoomaa qofa.',
    ti: 'ቅኑዕ URL ሰርቨር HTTPS ተጠቐሙ። HTTP ንልምዓት localhost ጥራይ ይፍቀድ።',
    so: 'Isticmaal URL adeegaha HTTPS oo sax ah. HTTP waxa la oggol yahay oo keliya horumarinta localhost.',
    ar: 'استخدم عنوان URL صالحًا لخادم HTTPS. يُسمح بـHTTP في بيئة localhost للتطوير فقط.',
    sw: 'Tumia URL halali ya seva ya HTTPS. HTTP inaruhusiwa tu kwa uendelezaji wa localhost.',
  },
  'Some services are temporarily unavailable: ': {
    am: 'አንዳንድ አገልግሎቶች ለጊዜው አይገኙም፦ ', om: 'Tajaajiloonni tokko tokko yeroo muraasaaf hin hojjetan: ', ti: 'ገለ ኣገልግሎታት ንግዚኡ ኣይርከቡን: ', so: 'Adeegyada qaarkood si ku-meel-gaar ah looma heli karo: ', ar: 'بعض الخدمات غير متاحة مؤقتًا: ', sw: 'Baadhi ya huduma hazipatikani kwa muda: ',
  },
  'ETHIOLIFE EDIR · MEMBERSHIP OFFER': {
    am: 'ETHIOLIFE EDIR · የአባልነት ጥያቄ', om: 'ETHIOLIFE EDIR · DHIYEESSA MISEENSUMMAA', ti: 'ETHIOLIFE EDIR · ቅርቦት ኣባልነት', so: 'ETHIOLIFE EDIR · DALABKA XUBINNIMADA', ar: 'ETHIOLIFE EDIR · عرض العضوية', sw: 'ETHIOLIFE EDIR · OFA YA UANACHAMA',
  },
  'API request metrics': {
    am: 'የAPI ጥያቄ መለኪያዎች', om: 'Safartuu gaaffii API', ti: 'መለክዒታት ሕቶ API', so: 'Cabbirrada codsiyada API-ga', ar: 'مقاييس طلبات API', sw: 'Vipimo vya maombi ya API',
  },
  'In-memory aggregate for this API process; counters reset when it restarts.': {
    am: 'ለዚህ የAPI ሂደት በማህደረ ትውስታ የተሰበሰበ ድምር ነው፤ ሂደቱ እንደገና ሲጀምር ቆጣሪዎቹ ይጀምራሉ።',
    om: 'Idaʼama adeemsa API kanaaf yaadannoo keessatti kuufame; yeroo adeemsi deebiʼee jalqabu lakkoofsi haaromsa.',
    ti: 'ንእዚ መስርሕ API ኣብ ናይ ስራሕ ዝኽሪ ዝተኣከበ ድምር እዩ፤ መስርሕ እንደገና ምስ ጀመረ ቆጸርቲ ይጅምሩ።',
    so: 'Waa wadarta xusuusta hawsha API-gan; tirooyinku waxay eber ka bilaabmaan marka dib loo bilaabo.',
    ar: 'إجمالي محفوظ في الذاكرة لعملية API هذه؛ تُصفّر العدادات عند إعادة تشغيلها.',
    sw: 'Hii ni jumla iliyohifadhiwa kwenye kumbukumbu ya mchakato huu wa API; vihesabio huanza upya mchakato unapowashwa tena.',
  },
  'More workspace sections': {
    am: 'ተጨማሪ የሥራ ቦታ ክፍሎች', om: 'Kutaa hojii dabalataa', ti: 'ተወሳኺ ክፍልታት ቦታ ስራሕ', so: 'Qaybo kale oo goobta shaqada ah', ar: 'أقسام مساحة العمل الإضافية', sw: 'Sehemu zaidi za eneo la kazi',
  },
  'More': {
    am: 'ተጨማሪ', om: 'Dabalata', ti: 'ተወሳኺ', so: 'Dheeraad', ar: 'المزيد', sw: 'Zaidi',
  },
  'Add a lead': {
    am: 'ደንበኛ ጨምር', om: 'Maamila dabali', ti: 'መራሒ ወስኽ', so: 'Ku dar macmiil', ar: 'أضف عميلًا محتملًا', sw: 'Ongeza mteja mtarajiwa',
  },
  'Add a worker': {
    am: 'ሠራተኛ ጨምር', om: 'Hojjetaa dabali', ti: 'ሰራሕተኛ ወስኽ', so: 'Ku dar shaqaale', ar: 'أضف عاملًا', sw: 'Ongeza mfanyakazi',
  },
  'Choose an area': {
    am: 'አካባቢ ይምረጡ', om: 'Naannoo filadhaa', ti: 'ከባቢ ምረጹ', so: 'Dooro goob', ar: 'اختر منطقة', sw: 'Chagua eneo',
  },
  'Create a request': {
    am: 'ጥያቄ ይፍጠሩ', om: 'Gaaffii uumaa', ti: 'ሕቶ ፍጠሩ', so: 'Abuur codsi', ar: 'أنشئ طلبًا', sw: 'Unda ombi',
  },
  'Choose a household or business lead': {
    am: 'የቤተሰብ ወይም የንግድ ደንበኛ ይምረጡ', om: 'Maamila maatii yookaan daldalaa filadhaa', ti: 'ዓሚል ስድራቤት ወይ ንግዲ ምረጹ', so: 'Dooro macmiil qoys ama ganacsi', ar: 'اختر عميلًا من أسرة أو شركة', sw: 'Chagua mteja wa kaya au biashara',
  },
  'Open skills': {
    am: 'ክህሎቶችን ይክፈቱ', om: 'Dandeettiiwwan bani', ti: 'ክእለታት ክፈቱ', so: 'Fur xirfadaha', ar: 'افتح المهارات', sw: 'Fungua ujuzi',
  },
  'Add a property listing': {
    am: 'የንብረት ዝርዝር ጨምር', om: 'Tarree qabeenyaa dabali', ti: 'ዝርዝር ንብረት ወስኽ', so: 'Ku dar liiska hanti', ar: 'أضف إعلان عقار', sw: 'Ongeza tangazo la nyumba',
  },
  'Category': {
    am: 'ምድብ', om: 'Ramaddii', ti: 'ምድብ', so: 'Qaybta', ar: 'الفئة', sw: 'Aina',
  },
  'Optional: I consent to sharing my name, phone number, and selected topic with one assigned AfroLife Agent for non-binding follow-up and referral to the Insurance service team. The Agent cannot advise, quote, collect premiums, or issue or change a policy.': {
    am: 'አማራጭ፦ ስሜን፣ ስልክ ቁጥሬንና የመረጥኩትን ርዕስ ለአንድ የተመደበ የAfroLife ወኪል ለማጋራት ተስማምቻለሁ፤ ወኪሉ የማያስገድድ ክትትል ያደርጋልና ወደ ኢንሹራንስ ቡድን ይመራል። ወኪሉ ምክር ወይም ዋጋ መስጠት፣ ፕሪሚየም መሰብሰብ፣ ፖሊሲ ማውጣት ወይም መቀየር አይችልም።',
    om: 'Filannoo: Maqaa, lakkoofsa bilbilaa fi mata-duree filattan bakka buʼaa AfroLife tokkoof akka qoodamu nan hayyama; inni hordoffii dirqama hin taane godhee gara garee inshuraansiitti isin qajeelcha. Bakka buʼaan gorsa kennuu, gatii himuu, kaffaltii inshuraansii walitti qabuu yookaan poolisii baasuu fi jijjiiruu hin dandaʼu.',
    ti: 'ኣማራጺ፦ ስመይ፣ ቁጽሪ ስልከይን ዝመረጽክዎ ኣርእስትን ምስ ሓደ ዝተመደበ ወኪል AfroLife ክካፈል ፈቒደ ኣለኹ፤ እቲ ወኪል ዘይግድን ክትትል ገይሩ ናብ ጉጅለ ውሕስነት ይመርሕ። ወኪል ምኽሪ ወይ ዋጋ ምሃብ፣ ፕሪሚየም ምእካብ፣ ፖሊሲ ምውጻእ ወይ ምቕያር ኣይክእልን።',
    so: 'Ikhtiyaari: Waxaan oggolahay in magacayga, lambarka telefoonka iyo mawduuca aan doortay lala wadaago hal Wakiil AfroLife oo la ii qoondeeyey si uu dabagal aan khasab ahayn u sameeyo iiguna gudbiyo kooxda adeegga Caymiska. Wakiilku ma bixin karo talo ama qiime, ma qaadi karo khidmad, mana soo saari karo ama beddeli karo caymis.',
    ar: 'اختياري: أوافق على مشاركة اسمي ورقم هاتفي والموضوع الذي اخترته مع وكيل واحد معيّن من AfroLife للمتابعة غير الملزمة وإحالتي إلى فريق التأمين. لا يجوز للوكيل تقديم المشورة أو عرض الأسعار أو تحصيل الأقساط أو إصدار وثيقة أو تعديلها.',
    sw: 'Hiari: Ninakubali jina langu, nambari ya simu na mada niliyochagua kushirikiwa na Wakala mmoja wa AfroLife kwa ufuatiliaji usio wa lazima na kuelekezwa kwa timu ya Bima. Wakala haruhusiwi kutoa ushauri au bei, kukusanya ada, kutoa au kubadilisha sera.',
  },
  'Insurance information request review': {
    am: 'የኢንሹራንስ መረጃ ጥያቄ ግምገማ', om: 'Gamaaggama gaaffii odeeffannoo inshuraansii', ti: 'ግምገማ ሕቶ ሓበሬታ ውሕስነት', so: 'Dib-u-eegista codsiyada macluumaadka caymiska', ar: 'مراجعة طلبات معلومات التأمين', sw: 'Ukaguzi wa maombi ya maelezo ya bima',
  },
  'Marketplace configuration': {
    am: 'የገበያ ቦታ ውቅር', om: 'Qindaaʼina gabaa', ti: 'ቅንብር ዕዳጋ', so: 'Dejinta suuqa', ar: 'إعدادات السوق', sw: 'Mipangilio ya soko',
  },
  'Manage domain availability, approval rules, media limits and listing categories. Changes apply to new submissions immediately.': {
    am: 'የገበያ ዘርፎችን መገኘት፣ የማጽደቅ ሕጎችን፣ የሚዲያ ገደቦችንና የዝርዝር ምድቦችን ያስተዳድሩ። ለአዳዲስ ማስገቢያዎች ለውጦቹ ወዲያውኑ ይተገበራሉ።',
    om: 'Argama dameewwan, seerota raggaasisaa, daangaa meediyaa fi ramaddiiwwan tarree bulchaa. Jijjiiramoonni galchaa haaraa irratti battalumatti hojii irra oolu.',
    ti: 'ተረኻብነት ዘርፍታት፣ ሕግታት ምጽዳቕ፣ ደረት ሚድያን ምድባት ዝርዝርን ኣመሓድሩ። ለውጢ ኣብ ሓደስቲ ምቕራባት ብኡንብኡ ይትግበር።',
    so: 'Maamul helitaanka qaybaha, xeerarka ansixinta, xadka warbaahinta iyo qaybaha liisaska. Isbeddelladu isla markiiba waxay khuseeyaan gudbinnada cusub.',
    ar: 'أدر إتاحة المجالات وقواعد الموافقة وحدود الوسائط وفئات القوائم. تُطبّق التغييرات فورًا على الطلبات الجديدة.',
    sw: 'Dhibiti upatikanaji wa maeneo, kanuni za idhini, vikomo vya midia na aina za matangazo. Mabadiliko hutumika mara moja kwa mawasilisho mapya.',
  },
  'Enabled domains': {
    am: 'የነቁ ዘርፎች', om: 'Dameewwan hojii irra jiran', ti: 'ዝነቑ ዘርፍታት', so: 'Qaybaha shaqaynaya', ar: 'المجالات المفعّلة', sw: 'Maeneo yaliyowezeshwa',
  },
  'Require staff review before publishing': {
    am: 'ከማተም በፊት የሠራተኛ ግምገማ ያስፈልጋል', om: 'Maxxansuu dura gamaaggama hojjettootaa barbaadi', ti: 'ቅድሚ ምሕታም ግምገማ ሰራሕተኛ ኣድሊ', so: 'U baahan dib-u-eegis shaqaale ka hor daabacaadda', ar: 'اشترط مراجعة الموظفين قبل النشر', sw: 'Hitaji ukaguzi wa wafanyakazi kabla ya kuchapisha',
  },
  'Self-registration account types and KYC': {
    am: 'የራስ-ምዝገባ የመለያ ዓይነቶችና KYC', om: 'Gosoota herregaa galmee ofii fi KYC', ti: 'ዓይነታት ሕሳብ ርእሰ-ምዝገባን KYCን', so: 'Noocyada akoonka isdiiwaangelinta iyo KYC', ar: 'أنواع الحسابات ذاتية التسجيل وKYC', sw: 'Aina za akaunti za kujisajili na KYC',
  },
  'Required registration documents': {
    am: 'የሚፈለጉ የምዝገባ ሰነዶች', om: 'Sanadoota galmee barbaachisan', ti: 'ሰነዳት ምዝገባ ዝድለዩ', so: 'Dukumentiyada diiwaangelinta ee loo baahan yahay', ar: 'مستندات التسجيل المطلوبة', sw: 'Hati za usajili zinazohitajika',
  },
  'Create a contract': {
    am: 'ውል ይፍጠሩ', om: 'Waliigaltee uumaa', ti: 'ውዕሊ ፍጠሩ', so: 'Abuur heshiis', ar: 'أنشئ عقدًا', sw: 'Unda mkataba',
  },
  'Choose an eligible lead': {
    am: 'ብቁ ደንበኛ ይምረጡ', om: 'Maamila ulaagaa guute filadhaa', ti: 'ብቑዕ መራሒ ምረጹ', so: 'Dooro macmiil u qalma', ar: 'اختر عميلًا مؤهلًا', sw: 'Chagua mteja anayestahili',
  },
  'Property period-close checks': {
    am: 'የንብረት ወቅት-መዝጊያ ምርመራዎች', om: 'Sakattaʼiinsa cufiinsa yeroo qabeenyaa', ti: 'ምርመራታት መዕጸዊ እዋን ንብረት', so: 'Hubinta xidhitaanka muddada hantida', ar: 'فحوصات إقفال فترة العقار', sw: 'Ukaguzi wa kufunga kipindi cha mali',
  },
  'Read-only exception checks for outstanding rent, receipts awaiting reconciliation and unbalanced rent journals. This is evidence for Finance review, not a period lock or accounting approval.': {
    am: 'ያልተከፈለ ኪራይን፣ ማስታረቅ የሚጠብቁ ደረሰኞችንና ሚዛን ያልጠበቁ የኪራይ መዝገቦችን በማንበብ ብቻ የሚደረጉ የልዩነት ምርመራዎች ናቸው። ይህ ለፋይናንስ ግምገማ ማስረጃ ነው፤ ወቅትን አይቆልፍም ወይም ሂሳብን አያጸድቅም።',
    om: 'Kiraa kaffaluu hafe, nagahee walsimsiisuu eeggatu fi galmee kiraa madaallii hin qabne kan dubbisuu qofaaf taʼe sakattaʼa. Kun gamaaggama Faayinaansiif ragaa dha; yeroo hin cufu yookaan herrega hin raggaasisu.',
    ti: 'እዞም ክንበቡ ጥራይ ዝኽእሉ ምርመራታት ክራይ ዘይተኸፍለ፣ ምስምማዕ ዝጽበዩ ደረሰኛታትን ዘይተመጣጠኑ መዝገባት ክራይን የለልዩ። እዚ ንግምገማ ፋይናንስ መርትዖ እዩ፤ እዋን ኣይዓጽውን ወይ ሒሳብ ኣየጽድቕን።',
    so: 'Waa hubin akhris-keliya ah oo lagu ogaado kirooyinka dhiman, rasiidhada sugaya isu-waafajinta iyo diiwaannada kirada ee aan dheellitirsanayn. Tani waa caddayn ay Maaliyaddu eegto, mana xidhayso muddada mana ansixinayso xisaabaadka.',
    ar: 'هذه فحوصات استثناء للقراءة فقط للإيجارات المستحقة والإيصالات التي تنتظر التسوية ودفاتر الإيجار غير المتوازنة. وهي دليل لمراجعة المالية، وليست إقفالًا للفترة أو موافقة محاسبية.',
    sw: 'Huu ni ukaguzi wa kusoma pekee wa kodi inayodaiwa, risiti zinazosubiri kulinganishwa na daftari za kodi zisizo sawia. Huu ni ushahidi wa ukaguzi wa Fedha, si kufunga kipindi wala idhini ya uhasibu.',
  },
  'Register a tenant': {
    am: 'ተከራይ ያስመዝግቡ', om: 'Kireeffataa galmeessaa', ti: 'ተኻራዪ መዝግቡ', so: 'Diiwaangeli kirayste', ar: 'سجّل مستأجرًا', sw: 'Sajili mpangaji',
  },
  'Create a lease draft': {
    am: 'የኪራይ ውል ረቂቅ ይፍጠሩ', om: 'Wixinee waliigaltee kiraa uumaa', ti: 'ረቂቕ ውዕሊ ክራይ ፍጠሩ', so: 'Abuur qabyo-qoraalka heshiiska kirada', ar: 'أنشئ مسودة عقد إيجار', sw: 'Unda rasimu ya mkataba wa upangaji',
  },
  'A lease stays inactive until independent approval, signature evidence, handover, and move-in inspection are recorded.': {
    am: 'ገለልተኛ ፈቃድ፣ የፊርማ ማስረጃ፣ ርክክብና የመግቢያ ምርመራ እስኪመዘገቡ ድረስ የኪራይ ውሉ ንቁ አይሆንም።',
    om: 'Waliigalteen kiraa hanga hayyamni nama biraa, ragaan mallattoo, dabarsuun fi sakattaʼiinsi seensaa galmaaʼanitti hojii irra hin oolu.',
    ti: 'ውዕሊ ክራይ ክሳብ ናጻ ፍቓድ፣ መርትዖ ፊርማ፣ ርክክብን ምርመራ ምእታውን ዝምዝገቡ ንጡፍ ኣይከውንን።',
    so: 'Heshiiska kiradu ma hawlgalo ilaa la diiwaangeliyo oggolaansho madax-bannaan, caddaynta saxeexa, wareejinta iyo kormeerka gelitaanka.',
    ar: 'يبقى عقد الإيجار غير نشط حتى تسجيل الموافقة المستقلة وإثبات التوقيع والتسليم وفحص الانتقال.',
    sw: 'Mkataba wa upangaji hubaki bila kutumika hadi idhini huru, uthibitisho wa sahihi, makabidhiano na ukaguzi wa kuhamia virekodiwe.',
  },
  'Choose a unit': {
    am: 'ክፍል ይምረጡ', om: 'Kutaa filadhaa', ti: 'ክፍሊ ምረጹ', so: 'Dooro qayb', ar: 'اختر وحدة', sw: 'Chagua nyumba',
  },
  'Choose a tenant': {
    am: 'ተከራይ ይምረጡ', om: 'Kireeffataa filadhaa', ti: 'ተኻራዪ ምረጹ', so: 'Dooro kirayste', ar: 'اختر مستأجرًا', sw: 'Chagua mpangaji',
  },
  'Payments awaiting reconciliation': {
    am: 'ማስታረቅን የሚጠብቁ ክፍያዎች', om: 'Kaffaltiiwwan walsimsiisuu eeggatan', ti: 'ክፍሊታት ምስምማዕ ዝጽበዩ', so: 'Lacag-bixinnada sugaya isu-waafajin', ar: 'المدفوعات التي تنتظر التسوية', sw: 'Malipo yanayosubiri kulinganishwa',
  },
  'Record a notice (operational record only)': {
    am: 'ማስታወቂያ ይመዝግቡ (የሥራ መዝገብ ብቻ)', om: 'Beeksisa galmeessaa (galmee hojii qofa)', ti: 'ምልክታ መዝግቡ (መዝገብ ስራሕ ጥራይ)', so: 'Diiwaangeli ogeysiis (diiwaan hawleed oo keliya)', ar: 'سجّل إشعارًا (سجل تشغيلي فقط)', sw: 'Rekodi notisi (rekodi ya shughuli pekee)',
  },
  'Recording does not verify legal service, create a legally valid notice, change lease status, or end the lease.': {
    am: 'መዝገቡ ሕጋዊ አገልግሎትን አያረጋግጥም፣ ሕጋዊ ማስታወቂያ አይፈጥርም፣ የኪራይ ውሉን ሁኔታ አይቀይርም ወይም አያቋርጥም።',
    om: 'Galmeessuun tajaajila seeraa hin mirkaneessu, beeksisa seeraan fudhatama qabu hin uumu, haala waliigaltee kiraa hin jijjiiru yookaan hin xumuru.',
    ti: 'ምምዝጋብ ሕጋዊ ምቕራብ ኣየረጋግጽን፣ ብሕጊ ቅቡል ዝኾነ ምልክታ ኣይፈጥርን፣ ኩነታት ውዕሊ ክራይ ኣይቅይርን ወይ ኣየቋርጽን።',
    so: 'Diiwaangelintu ma xaqiijiso adeeg sharci ah, ma abuureyso ogeysiis sharci ahaan sax ah, mana beddesho ama joojiso xaaladda heshiiska kirada.',
    ar: 'لا يثبت التسجيل التبليغ القانوني ولا ينشئ إشعارًا صالحًا قانونًا ولا يغيّر حالة عقد الإيجار أو ينهيه.',
    sw: 'Kurekodi hakuthibitishi huduma ya kisheria, hakuundi notisi halali kisheria, wala hakubadilishi au kusitisha hali ya mkataba wa upangaji.',
  },
  'Business rules': {
    am: 'የንግድ ሕጎች', om: 'Seerota daldalaa', ti: 'ሕግታት ንግዲ', so: 'Xeerarka ganacsiga', ar: 'قواعد الأعمال', sw: 'Kanuni za biashara',
  },
  'Changes apply to new calculations immediately. Unsigned contracts are repriced; signed contracts, recorded payments, and ledger entries are not rewritten.': {
    am: 'ለውጦች በአዲስ ስሌቶች ላይ ወዲያውኑ ይተገበራሉ። ያልተፈረሙ ውሎች ዋጋቸው እንደገና ይሰላል፤ የተፈረሙ ውሎች፣ የተመዘገቡ ክፍያዎችና የሂሳብ መዝገቦች አይቀየሩም።',
    om: 'Jijjiiramoonni shallaggii haaraa irratti battalumatti hojii irra oolu. Waliigalteewwan hin mallatteeffamne gatiin isaanii deebiʼee shallagama; waliigalteewwan mallatteeffaman, kaffaltiin galmaaʼe fi galmeewwan herregaa hin jijjiiraman.',
    ti: 'ለውጥታት ኣብ ሓደስቲ ስሌታት ብኡንብኡ ይትግበሩ። ዘይተፈረሙ ውዕላት ዋጋኦም ዳግማይ ይሕሰብ፤ ዝተፈረሙ ውዕላት፣ ዝተመዝገቡ ክፍሊታትን መዝገባት ሒሳብን ኣይቅየሩን።',
    so: 'Isbeddelladu isla markiiba waxay khuseeyaan xisaabaha cusub. Heshiisyada aan la saxeexin qiimahooda dib ayaa loo xisaabiyaa; heshiisyada la saxeexay, lacagaha la diiwaangeliyey iyo gelinnada xisaabtu dib looma qoro.',
    ar: 'تُطبّق التغييرات فورًا على الحسابات الجديدة. يعاد تسعير العقود غير الموقعة؛ ولا يعاد تحرير العقود الموقعة أو المدفوعات المسجلة أو قيود الدفاتر.',
    sw: 'Mabadiliko hutumika mara moja kwa hesabu mpya. Bei za mikataba ambayo haijasainiwa hukokotolewa upya; mikataba iliyosainiwa, malipo yaliyorekodiwa na maingizo ya daftari hayabadilishwi.',
  },
  'Required identity and police-clearance checks, role permissions, and separate payment approvals cannot be disabled here.': {
    am: 'የሚፈለጉ የመታወቂያና የፖሊስ ማረጋገጫ ምርመራዎች፣ የሚና ፈቃዶችና የተለየ የክፍያ ማጽደቅ እዚህ ሊሰናከሉ አይችሉም።',
    om: 'Sakattaʼiinsi eenyummaa fi qulqullina poolisii barbaachisan, hayyamni gahee fi raggaasifni kaffaltii adda taʼe asitti dhaabuu hin dandaʼamu.',
    ti: 'ዝድለዩ ምርመራታት መንነትን ናይ ፖሊስ ምጽራይን፣ ፍቓዳት ሚናን ፍሉይ ምጽዳቕ ክፍሊትን ኣብዚ ክስናኽሉ ኣይክእሉን።',
    so: 'Hubinta aqoonsiga iyo warqadda booliska ee loo baahan yahay, oggolaanshaha doorarka iyo ansixinta lacag-bixinta ee goonida ah halkan lagama damin karo.',
    ar: 'لا يمكن تعطيل فحوصات الهوية والسجل الشرطي المطلوبة أو صلاحيات الأدوار أو موافقات الدفع المنفصلة هنا.',
    sw: 'Ukaguzi unaohitajika wa utambulisho na cheti cha polisi, ruhusa za majukumu na idhini tofauti za malipo haviwezi kuzimwa hapa.',
  },
  'Global Admin governance': {
    am: 'የግሎባል አስተዳዳሪ አስተዳደር', om: 'Bulchiinsa Admin Addunyaa', ti: 'ምምሕዳር Global Admin', so: 'Maamulka Global Admin', ar: 'حوكمة المسؤول العام', sw: 'Utawala wa Msimamizi wa Jumla',
  },
  'Global Admin role promotion': {
    am: 'የግሎባል አስተዳዳሪ የማሳደግ ሂደት',
    om: 'Adeemsa ol-ka’iinsa Admin Addunyaa',
    ti: 'ናይ Global Admin ምዕባለ ስርዓት',
    so: 'Habka dallacaadda Global Admin',
    ar: 'عملية ترقية المسؤول العام',
    sw: 'Mchakato wa kupandisha cheo kwa Msimamizi wa Jumla',
  },
  'Promotion requires two different active, MFA-enabled Super Admins. Global Admin access does not bypass financial maker-checker approvals.': {
    am: 'ማሳደግ ሁለት የተለያዩ፣ ንቁና MFA የነቃላቸው ሱፐር አስተዳዳሪዎችን ይፈልጋል። የግሎባል አስተዳዳሪ መዳረሻ የፋይናንስ አዘጋጅ-አጽዳቂ ፈቃድን አያልፍም።',
    om: 'Ol-kaasuuf Super Admin lama adda addaa, hojii irra jiran fi MFA isaanii baname barbaachisu. Seensaan Admin Addunyaa raggaasisa faayinaansii qopheessaa-raggaasisaa hin bira darbu.',
    ti: 'ምዕባለ ክልተ ዝተፈላለዩ፣ ንጡፋትን MFA ዝተነቕሐሎምን Super Admin ይሓትት። መእተዊ Global Admin ናይ ፋይናንስ ኣዳላው-ኣጽዳቒ ምጽዳቕ ኣይሓልፍን።',
    so: 'Dallacaaddu waxay u baahan tahay laba Super Admin oo kala duwan, firfircoon, MFA-na u shaqaynayso. Gelitaanka Global Admin kama boodo ansixinta maaliyadeed ee diyaariye iyo hubiye.',
    ar: 'يتطلب الترفيع وجود مسؤولين فائقين مختلفين ونشطين مع تفعيل MFA. ولا يتجاوز وصول المسؤول العام موافقات الإعداد والمراجعة المالية.',
    sw: 'Kupandishwa cheo kunahitaji Wasimamizi Wakuu wawili tofauti walio hai na wenye MFA. Ufikiaji wa Msimamizi wa Jumla haupiti idhini za kifedha za mtayarishaji na mkaguzi.',
  },
  'No pending Super Admin accounts are awaiting activation.': {
    am: 'ምንም ማግበርን የሚጠብቅ የሱፐር አስተዳዳሪ መለያ የለም።',
    om: 'Herregni Super Admin hojii eeggataa ta’ee jiru hin jiru.',
    ti: 'ንምንቅስቓስ ዝጽበዩ ሕሳባት Super Admin የለዉን።',
    so: 'Ma jiraan akoonno Super Admin ah oo sugaya in la hawlgeliyo.',
    ar: 'لا توجد حسابات مسؤول فائق بانتظار التفعيل.',
    sw: 'Hakuna akaunti za Msimamizi Mkuu zinazosubiri kuwezeshwa.',
  },
  'Promotion requires two different active, MFA-enabled platform administrators. Global Admin access does not bypass financial maker-checker approvals.': {
    am: 'ማሳደግ ሁለት የተለያዩ፣ ንቁና MFA የነቃላቸው የመድረክ አስተዳዳሪዎችን ይፈልጋል። የግሎባል አስተዳዳሪ መዳረሻ የፋይናንስ አዘጋጅ-አጽዳቂ ፈቃድን አያልፍም።',
    om: 'Ol kaasuuf bulchitoota waltajjii lama, kanneen adda taʼan, hojii irra jiran fi MFA isaanii baname barbaachisa. Seensaan Admin Addunyaa raggaasisa faayinaansii qopheessaa-raggaasisaa hin bira darbu.',
    ti: 'ምስ ምዕባለ ክልተ ዝተፈላለዩ፣ ንጡፋትን MFA ዝተነቕሐሎምን ምምሕዳራት መድረኽ የድሊ። መእተዊ Global Admin ናይ ፋይናንስ ኣዳላው-ኣጽዳቒ ምጽዳቕ ኣይሓልፍን።',
    so: 'Dallacaaddu waxay u baahan tahay laba maamule madal oo kala duwan, firfircoon, MFA-na u shaqaynayso. Gelitaanka Global Admin kama boodo ansixinta maaliyadeed ee diyaariye iyo hubiye.',
    ar: 'يتطلب الترفيع وجود مسؤولين مختلفين ونشطين في المنصة مع تفعيل MFA. ولا يتجاوز وصول المسؤول العام موافقات الإعداد والمراجعة المالية.',
    sw: 'Kupandishwa cheo kunahitaji wasimamizi wawili tofauti wa jukwaa walio hai na wenye MFA. Ufikiaji wa Msimamizi wa Jumla haupiti idhini za kifedha za mtayarishaji na mkaguzi.',
  },
  'Choose a Super Admin': {
    am: 'ሱፐር አስተዳዳሪ ይምረጡ', om: 'Super Admin filadhaa', ti: 'Super Admin ምረጹ', so: 'Dooro Super Admin', ar: 'اختر مسؤولًا فائقًا', sw: 'Chagua Msimamizi Mkuu',
  },
  'No other active, MFA-enabled Super Admin is currently eligible for nomination.': {
    am: 'በአሁኑ ጊዜ ለመመረጥ ብቁ የሆነ ሌላ ንቁና MFA የነቃለት ሱፐር አስተዳዳሪ የለም።',
    om: 'Yeroo ammaa Super Admin biraa hojii irra jiru, MFA qabuu fi muudamaaf ulaagaa guute hin jiru.',
    ti: 'ኣብዚ እዋን ንምምራጽ ብቑዕ ዝኾነ ካልእ ንጡፍ፣ MFA ዝተነቕሐሉ Super Admin የለን።',
    so: 'Hadda ma jiro Super Admin kale oo firfircoon, MFA leh, isla markaana u qalma in la magacaabo.',
    ar: 'لا يوجد حاليًا مسؤول فائق آخر نشط ومفعّل لديه MFA ومؤهل للترشيح.',
    sw: 'Kwa sasa hakuna Msimamizi Mkuu mwingine aliye hai, mwenye MFA na anayestahili kuteuliwa.',
  },
  'Promotion requests': {
    am: 'የማሳደግ ጥያቄዎች', om: 'Gaaffiiwwan ol kaasuu', ti: 'ሕቶታት ምምዕባለ', so: 'Codsiyada dallacaadda', ar: 'طلبات الترفيع', sw: 'Maombi ya kupandishwa cheo',
  },
  'Role and activity access': {
    am: 'የሚናና የእንቅስቃሴ መዳረሻ', om: 'Seensa gahee fi sochii', ti: 'መእተዊ ሚናን ንጥፈትን', so: 'Gelitaanka doorka iyo hawsha', ar: 'الوصول حسب الدور والنشاط', sw: 'Ufikiaji wa jukumu na shughuli',
  },
  'Select the activities each role may perform. Sensitive financial actions remain subject to transaction controls and independent-actor checks. Tenant Super Admin scope is managed through tenant assignments.': {
    am: 'እያንዳንዱ ሚና ሊያከናውናቸው የሚችሉ እንቅስቃሴዎችን ይምረጡ። ስሱ የፋይናንስ ድርጊቶች ለግብይት ቁጥጥርና ለገለልተኛ ተዋናይ ማረጋገጫ ተገዢ ናቸው። የተከራይ ሱፐር አስተዳዳሪ ወሰን በተከራይ ምደባዎች ይተዳደራል።',
    om: 'Sochiiwwan gaheen tokkoon tokkoon isaanii raawwachuu dandaʼan filadhaa. Hojiiwwan faayinaansii miira-qabeeyyiin toʼannoo daldalaa fi mirkaneessa nama biraa jalatti hafu. Daangaan Super Admin tenant ramaddii tenant tiin bulfama.',
    ti: 'ነፍሲ ወከፍ ሚና ከካይዶም ዝኽእል ንጥፈታት ምረጹ። ስሱዓት ፋይናንሳዊ ተግባራት ቁጽጽር ግብይትን ናጻ ምርግጋጽ ተዋሳኢን ይምልከቶም። ወሰን Super Admin ተናንት ብምደባ ተናንት ይምራሕ።',
    so: 'Dooro hawlaha door kastaa qaban karo. Tallaabooyinka maaliyadeed ee xasaasiga ahi waxay weli hoos imanayaan xakamaynta macaamilka iyo hubinta qof kale oo madax-bannaan. Baaxadda Super Admin-ka kiraystaha waxaa lagu maamulaa meelaynta kiraystaha.',
    ar: 'حدد الأنشطة التي يمكن لكل دور تنفيذها. تظل الإجراءات المالية الحساسة خاضعة لضوابط المعاملات والتحقق من استقلالية المنفّذ. يُدار نطاق المسؤول الفائق للمستأجر عبر تعيينات المستأجر.',
    sw: 'Chagua shughuli ambazo kila jukumu linaweza kufanya. Hatua nyeti za kifedha bado zinadhibitiwa na taratibu za miamala na ukaguzi wa mhusika huru. Wigo wa Msimamizi Mkuu wa mpangaji husimamiwa kupitia ugawaji wa wapangaji.',
  },
  'Production readiness evidence': {
    am: 'የምርት ዝግጁነት ማስረጃ', om: 'Ragaa qophii oomishaa', ti: 'መርትዖ ድልውነት ምርት', so: 'Caddaynta u-diyaargarowga wax-soo-saarka', ar: 'أدلة الجاهزية للإنتاج', sw: 'Ushahidi wa utayari wa uzalishaji',
  },
  'Append operational evidence for each service. Records are stored in the shared database and attributed to the signed-in administrator. An evidence record does not itself grant legal, provider, finance, or production authorization.': {
    am: 'ለእያንዳንዱ አገልግሎት የሥራ ማስረጃ ይጨምሩ። መዝገቦቹ በጋራ የውሂብ ጎታ ይቀመጣሉና ከገባው አስተዳዳሪ ጋር ይያያዛሉ። የማስረጃ መዝገብ ብቻውን ሕጋዊ፣ የአቅራቢ፣ የፋይናንስ ወይም የምርት ፈቃድ አይሰጥም።',
    om: 'Tajaajila tokkoon tokkoof ragaa hojii dabaladhaa. Galmeewwan kuusdeetaa waliinii keessatti kuufamu, bulchaa seeneettis ramadamu. Galmeen ragaa qofti hayyama seeraa, dhiyeessaa, faayinaansii yookaan oomishaa hin kennu.',
    ti: 'ንነፍሲ ወከፍ ኣገልግሎት መርትዖ ስራሕ ወስኹ። መዝገባት ኣብ ሓባራዊ ዳታቤዝ ይቕመጡን ምስቲ ዝኣተወ ምምሕዳር ይተሓሓዙን። መዝገብ መርትዖ ባዕሉ ሕጋዊ፣ ናይ ኣቕራቢ፣ ፋይናንሳዊ ወይ ናይ ምርት ፍቓድ ኣይህብን።',
    so: 'Ku dar caddayn hawlgal adeeg kasta. Diiwaannada waxaa lagu kaydiyaa xogta la wadaago, waxaana loo nisbeeyaa maamulaha galay. Diiwaanka caddayntu keligiis ma bixiyo oggolaansho sharci, bixiye, maaliyadeed ama wax-soo-saar.',
    ar: 'أضف أدلة تشغيلية لكل خدمة. تُحفظ السجلات في قاعدة البيانات المشتركة وتُنسب إلى المسؤول المسجل دخوله. لا يمنح سجل الأدلة بحد ذاته تفويضًا قانونيًا أو من مزود أو ماليًا أو للإنتاج.',
    sw: 'Ongeza ushahidi wa uendeshaji kwa kila huduma. Rekodi huhifadhiwa kwenye hifadhidata ya pamoja na kuhusishwa na msimamizi aliyeingia. Rekodi ya ushahidi yenyewe haitoi idhini ya kisheria, mtoa huduma, fedha au uzalishaji.',
  },
  'Insurance brokerage regulatory release gates': {
    am: 'Vikwazo vya idhini ya udhibiti wa udalali wa bima', om: 'Ulaagaalee eeyyama seeraa daldala inshuraansii', ti: 'መዕገቲታት ምፍታሕ ሕጊ ደላላ ውሕስነት', so: 'Shuruudaha sii-daynta sharciyeynta dilaalka caymiska', ar: 'بوابات الإطلاق التنظيمي لوساطة التأمين', sw: 'Vigezo vya kutolewa kwa udhibiti wa udalali wa bima',
  },
  'Evidence is a readiness record, not a regulatory approval or certification. Live brokerage activity remains disabled until all applicable gates are independently reviewed and separately approved.': {
    am: 'ማስረጃው የዝግጁነት መዝገብ ነው፤ የቁጥጥር ፈቃድ ወይም ማረጋገጫ አይደለም። ሁሉም ተፈጻሚ መድረኮች በገለልተኛ ሁኔታ ተገምግመው ለየት ብለው እስኪጸድቁ ድረስ ቀጥታ የደላላ ሥራ ይሰናከላል።',
    om: 'Ragaan galmee qophii ti; hayyama seeraa yookaan ragaa mirkaneessaa miti. Hojii daldala kallattii kanneen ilaallatan hundi of dandaʼanii gamaaggamamee adda baafamanii hanga raggaasifamanitti cufaa taʼu.',
    ti: 'መርትዖ መዝገብ ድልውነት እዩ፣ ፍቓድ ቁጽጽር ወይ ምስክር ወረቐት ኣይኮነን። ኩሎም ዝምልከቱ መዕገቲታት ብናጻ ክሳብ ዝግምገሙን ብፍሉይ ዝጸድቁን ንጡፍ ስራሕ ደላላ ይስናኸል።',
    so: 'Caddayntu waa diiwaanka diyaargarowga, ma aha oggolaansho ama shahaado sharciyeyn. Hawsha dilaalka tooska ahi way xirnaanaysaa ilaa dhammaan shuruudaha la khuseeyo si madax-bannaan loo eego loona ansixiyo.',
    ar: 'الأدلة سجل للجاهزية وليست موافقة تنظيمية أو شهادة. يظل نشاط الوساطة الفعلي معطلًا حتى تُراجع جميع المتطلبات المنطبقة بشكل مستقل وتُعتمد كلٌّ على حدة.',
    sw: 'Ushahidi ni rekodi ya utayari, si idhini au cheti cha udhibiti. Udalali wa moja kwa moja hubaki umezimwa hadi vigezo vyote vinavyohusika vikaguliwe kwa uhuru na kuidhinishwa kando.',
  },
  'No evidence recorded.': {
    am: 'ምንም ማስረጃ አልተመዘገበም።', om: 'Ragaan hin galmoofne.', ti: 'ዝኾነ መርትዖ ኣይተመዝገበን።', so: 'Wax caddayn ah lama diiwaangelin.', ar: 'لم يتم تسجيل أي أدلة.', sw: 'Hakuna ushahidi uliorekodiwa.',
  },
  'Tenant and service control plane': {
    am: 'የተከራይና የአገልግሎት መቆጣጠሪያ ማዕከል', om: 'Buufata toʼannoo tenant fi tajaajilaa', ti: 'ማእከል ቁጽጽር ተናንትን ኣገልግሎትን', so: 'Xarunta xakamaynta kiraystaha iyo adeegga', ar: 'مركز التحكم بالمستأجر والخدمات', sw: 'Kitovu cha udhibiti wa mpangaji na huduma',
  },
  'Manage platform services, packages, tenant deployments, assignments, and non-financial catalog products. Tenant database credentials and infrastructure secrets are never stored here. Package availability affects workspace modules only when an authorized platform-tenant context is selected; it does not replace user role, activity, or service checks.': {
    am: 'የመድረክ አገልግሎቶችን፣ ጥቅሎችን፣ የተከራይ ማሰማራቶችን፣ ምደባዎችንና የፋይናንስ ያልሆኑ የካታሎግ ምርቶችን ያስተዳድሩ። የተከራይ የውሂብ ጎታ መግቢያ መረጃና የመሠረተ ልማት ምስጢሮች እዚህ አይቀመጡም። የጥቅል መገኘት የሥራ ቦታ ሞጁሎችን የሚነካው የተፈቀደ የመድረክ-ተከራይ አውድ ሲመረጥ ብቻ ነው፤ የተጠቃሚ ሚናን፣ እንቅስቃሴን ወይም የአገልግሎት ምርመራዎችን አይተካም።',
    om: 'Tajaajiloota waltajjii, paakeejii, hojii irra oolmaa tenant, ramaddii fi oomisha kaataaloogii faayinaansii hin taane bulchaa. Ragaan seensaa kuusdeetaa fi iccitiin buʼuraalee teeknooloojii tenant asitti matumaa hin kuufamu. Paakeejiin jiru mojuulota iddoo hojii kan miidhu yeroo qofa haalli tenant waltajjii hayyamame filatamu; gahee fayyadamaa, sochii yookaan sakattaʼiinsa tajaajilaa hin bakka buʼu.',
    ti: 'ኣገልግሎታት መድረኽ፣ ጥሙራት፣ ምስፋሕ ተናንት፣ ምደባታትን ፋይናንሳዊ ዘይኮኑ ፍርያት ካታሎግን ኣመሓድሩ። ምስጢራት መእተዊ ዳታቤዝን መሰረተ ልምዓትን ተናንት ኣብዚ ኣይቕመጡን። ተረኻብነት ጥሙር ንሞጁላት ቦታ ስራሕ ዝጸልዎ ፍቑድ ኣውድ ተናንት መድረኽ ምስ ተመርጸ ጥራይ እዩ፤ ሚና፣ ንጥፈት ወይ ምርመራ ኣገልግሎት ኣይትክእን።',
    so: 'Maamul adeegyada madasha, xirmooyinka, geynta kiraystayaasha, meelaynta iyo badeecooyinka aan maaliyadda ahayn ee buugga. Aqoonsiyada xogta kiraystaha iyo siraha kaabayaasha halkan laguma kaydiyo. Helitaanka xirmadu wuxuu saameeyaa qaybaha goobta shaqada oo keliya marka la doorto macnaha kiraystaha madasha ee la oggolaaday; ma beddelayo doorka, hawsha ama hubinta adeegga isticmaalaha.',
    ar: 'أدر خدمات المنصة وباقاتها وعمليات نشر المستأجرين والتعيينات ومنتجات الكتالوج غير المالية. لا تُحفظ هنا بيانات اعتماد قواعد بيانات المستأجرين أو أسرار البنية التحتية. يؤثر توفر الباقة في وحدات مساحة العمل فقط عند اختيار سياق مستأجر منصة مخوّل؛ ولا يحل محل التحقق من دور المستخدم أو نشاطه أو الخدمة.',
    sw: 'Dhibiti huduma za jukwaa, vifurushi, mifumo ya wapangaji, ugawaji na bidhaa zisizo za kifedha za katalogi. Taarifa za kuingia kwenye hifadhidata ya mpangaji na siri za miundombinu hazihifadhiwi hapa. Upatikanaji wa kifurushi huathiri moduli za eneo la kazi tu muktadha ulioidhinishwa wa mpangaji wa jukwaa unapochaguliwa; hauchukui nafasi ya ukaguzi wa jukumu, shughuli au huduma.',
  },
  'No tenant package context': {
    am: 'የተከራይ ጥቅል አውድ የለም', om: 'Haalli paakeejii tenant hin jiru', ti: 'ኣውድ ጥሙር ተናንት የለን', so: 'Ma jiro macnaha xirmada kiraystaha', ar: 'لا يوجد سياق باقة للمستأجر', sw: 'Hakuna muktadha wa kifurushi cha mpangaji',
  },
  'Services included': {
    am: 'የተካተቱ አገልግሎቶች', om: 'Tajaajiloota dabalaman', ti: 'ዝተኣከቱ ኣገልግሎታት', so: 'Adeegyada ku jira', ar: 'الخدمات المشمولة', sw: 'Huduma zilizojumuishwa',
  },
  'Included services': {
    am: 'የተካተቱ አገልግሎቶች', om: 'Tajaajiloota dabalaman', ti: 'ኣገልግሎታት ዝተኣከቱ', so: 'Adeegyada ku jira', ar: 'الخدمات المشمولة', sw: 'Huduma zilizojumuishwa',
  },
  'Choose service package': {
    am: 'የአገልግሎት ጥቅል ይምረጡ', om: 'Paakeejii tajaajilaa filadhaa', ti: 'ጥሙር ኣገልግሎት ምረጹ', so: 'Dooro xirmada adeegga', ar: 'اختر باقة الخدمات', sw: 'Chagua kifurushi cha huduma',
  },
  'Agent and Super Admin business tenants': {
    am: 'የወኪልና የሱፐር አስተዳዳሪ የንግድ ተከራዮች', om: 'Tenant daldalaa bakka buʼaa fi Super Admin', ti: 'ተናንት ንግዲ ወኪልን Super Adminን', so: 'Kiraystayaasha ganacsi ee wakiilka iyo Super Admin-ka', ar: 'مستأجرو أعمال الوكلاء والمسؤولين الفائقين', sw: 'Wapangaji wa biashara wa wakala na Msimamizi Mkuu',
  },
  'These are business workspaces in the Global Platform. They are separate from deployment tenants, which track hosting and infrastructure. Master Agents own agent-network tenants; their Field Agents join through the registered parent relationship. Tenant Super Admins have their own tenant boundary.': {
    am: 'እነዚህ በግሎባል መድረክ ያሉ የንግድ የሥራ ቦታዎች ናቸው። ማስተናገጃና መሠረተ ልማትን ከሚከታተሉ የማሰማራት ተከራዮች የተለዩ ናቸው። ዋና ወኪሎች የወኪል መረብ ተከራዮችን ይይዛሉ፤ የመስክ ወኪሎቻቸው በተመዘገበው የወላጅ ግንኙነት ይቀላቀላሉ። የተከራይ ሱፐር አስተዳዳሪዎች የራሳቸው የተከራይ ወሰን አላቸው።',
    om: 'Iddoowwan hojii daldalaa waltajjii Addunyaa keessa jiran kana. Tenant hojii irra oolmaa kan keessummeessitoota fi buʼura teeknooloojii hordofu irraa adda. Master Agent tenant neetworkii bakka buʼootaa qaba; Field Agent isaanii karaa hariiroo warra galmaaʼeen makamu. Super Admin tenant daangaa tenant mataa isaa qaba.',
    ti: 'እዚኣቶም ኣብ መድረኽ ዓለምለኻዊ ዘለዉ ቦታታት ስራሕ ንግዲ እዮም። ካብ ምእንጋድን መሰረተ ልምዓትን ዝከታተሉ ተናንት ምስፋሕ ፍሉያት እዮም። Master Agent ተናንት መርበብ ወከልቲ ይውንን፤ Field Agentኡ ብዝተመዝገበ ርክብ ወላዲ ይጽንበር። Super Admin ተናንት ናይ ገዛእ ርእሱ ወሰን ተናንት ኣለዎ።',
    so: 'Kuwani waa goobo shaqo ganacsi oo ku jira Madasha Caalamiga ah. Way ka duwan yihiin kiraystayaasha geynta ee la socda martigelinta iyo kaabayaasha. Master Agents waxay leeyihiin kiraystayaasha shabakadda wakiillada; Field Agents-koodu waxay ku biiraan xiriirka waalidka ee diiwaangashan. Super Admin kasta oo kirayste ahi wuxuu leeyahay xad u gaar ah.',
    ar: 'هذه مساحات عمل تجارية على المنصة العالمية، وهي منفصلة عن مستأجري النشر الذين يتابعون الاستضافة والبنية التحتية. يمتلك الوكلاء الرئيسيون مستأجري شبكات الوكلاء، وينضم وكلاء الميدان عبر علاقة الوالد المسجلة. ولكل مسؤول فائق للمستأجر نطاق مستأجر خاص.',
    sw: 'Haya ni maeneo ya biashara kwenye Jukwaa la Kimataifa. Ni tofauti na wapangaji wa usambazaji wanaofuatilia upangishaji wa seva na miundombinu. Mawakala Wakuu wanamiliki wapangaji wa mtandao wa mawakala; Mawakala wa Uwanjani hujiunga kupitia uhusiano wa mzazi uliosajiliwa. Wasimamizi Wakuu wa wapangaji wana mipaka yao binafsi.',
  },
  'Choose an active Super Admin': {
    am: 'ንቁ ሱፐር አስተዳዳሪ ይምረጡ', om: 'Super Admin hojii irra jiru filadhaa', ti: 'ንጡፍ Super Admin ምረጹ', so: 'Dooro Super Admin firfircoon', ar: 'اختر مسؤولًا فائقًا نشطًا', sw: 'Chagua Msimamizi Mkuu aliye hai',
  },
  'Keep current packages': {
    am: 'ያሉትን ጥቅሎች ይቀጥሉ', om: 'Paakeejiiwwan amma jiran tursaa', ti: 'እዞም ዘለዉ ጥሙራት ዓቅቡ', so: 'Hay xirmooyinka hadda jira', ar: 'أبقِ الباقات الحالية', sw: 'Hifadhi vifurushi vya sasa',
  },
  'Assigned business entities': {
    am: 'የተመደቡ የንግድ ድርጅቶች', om: 'Dhaabbilee daldalaa ramadaman', ti: 'ትካላት ንግዲ ዝተመደቡ', so: 'Hay’adaha ganacsi ee laguu qoondeeyey', ar: 'الكيانات التجارية المعيّنة', sw: 'Mashirika ya biashara yaliyogawiwa',
  },
  'Configure business modules only within entities assigned by the Global System Admin. Global System Admin controls tenant onboarding, service packages, platform-wide module availability, and Super Admin assignments.': {
    am: 'በግሎባል ሲስተም አስተዳዳሪ በተመደቡ ድርጅቶች ውስጥ ብቻ የንግድ ሞጁሎችን ያዋቅሩ። ግሎባል ሲስተም አስተዳዳሪ የተከራይ ምዝገባን፣ የአገልግሎት ጥቅሎችን፣ የመድረክ ሁሉ ሞጁል መገኘትንና የሱፐር አስተዳዳሪ ምደባን ይቆጣጠራል።',
    om: 'Mojuulota daldalaa dhaabbilee Admin Sirna Addunyaa tiin ramadaman keessatti qofa qindeessaa. Admin Sirna Addunyaa galmee tenant, paakeejii tajaajilaa, argama mojuulii waltajjii guutuu fi ramaddii Super Admin ni toʼata.',
    ti: 'ሞጁላት ንግዲ ኣብቶም ብGlobal System Admin ዝተመደቡ ትካላት ጥራይ ኣዳልዉ። Global System Admin ምምዝጋብ ተናንት፣ ጥሙራት ኣገልግሎት፣ ኣብ ምሉእ መድረኽ ተረኻብነት ሞጁላትን ምደባ Super Adminን ይቆጻጸር።',
    so: 'Deji qaybaha ganacsiga oo keliya hay’adaha uu kuu qoondeeyey Maamulaha Nidaamka Caalamiga ah. Maamulaha Nidaamka Caalamiga ahi wuxuu xakameeyaa diiwaangelinta kiraystaha, xirmooyinka adeegga, helitaanka qaybaha guud ee madasha iyo meelaynta Super Admin.',
    ar: 'اضبط وحدات الأعمال داخل الكيانات التي يعيّنها مسؤول النظام العالمي فقط. يتحكم مسؤول النظام العالمي في تسجيل المستأجرين وباقات الخدمات وإتاحة الوحدات على مستوى المنصة وتعيينات المسؤولين الفائقين.',
    sw: 'Sanidi moduli za biashara ndani ya mashirika aliyokukabidhi Msimamizi wa Mfumo wa Kimataifa pekee. Msimamizi huyo hudhibiti usajili wa wapangaji, vifurushi vya huduma, upatikanaji wa moduli katika jukwaa lote na ugawaji wa Wasimamizi Wakuu.',
  },
  'Select an assigned entity': {
    am: 'የተመደበ ድርጅት ይምረጡ', om: 'Dhaabbata ramadame filadhaa', ti: 'ትካል ዝተመደበ ምረጹ', so: 'Dooro hay’ad laguu qoondeeyey', ar: 'اختر كيانًا معيّنًا', sw: 'Chagua shirika ulilokabidhiwa',
  },
  'Choose an assigned active entity to open its approved business modules.': {
    am: 'የተፈቀዱ የንግድ ሞጁሎችን ለመክፈት ንቁ የተመደበ ድርጅት ይምረጡ።', om: 'Mojuulota daldalaa hayyamaman banuuf dhaabbata hojii irra jiru kan ramadame filadhaa.', ti: 'ሞጁላት ንግዲ ዝተፈቕዱ ንምኽፋት ንጡፍ ትካል ዝተመደበ ምረጹ።', so: 'Dooro hay’ad firfircoon oo laguu qoondeeyey si aad u furto qaybaha ganacsiga ee la ansixiyey.', ar: 'اختر كيانًا نشطًا معيّنًا لفتح وحدات الأعمال المعتمدة له.', sw: 'Chagua shirika hai ulilokabidhiwa ili kufungua moduli zake za biashara zilizoidhinishwa.',
  },
  'Enabled business modules': {
    am: 'የነቁ የንግድ ሞጁሎች', om: 'Mojuulota daldalaa hojii irra jiran', ti: 'ሞጁላት ንግዲ ዝነቑ', so: 'Qaybaha ganacsi ee shaqaynaya', ar: 'وحدات الأعمال المفعّلة', sw: 'Moduli za biashara zilizowezeshwa',
  },
  'Global System Admin must activate this entity before its business modules can be used.': {
    am: 'የንግድ ሞጁሎቹን ከመጠቀምዎ በፊት ግሎባል ሲስተም አስተዳዳሪ ይህን ድርጅት ማንቃት አለበት።',
    om: 'Mojuulota daldalaa isaa fayyadamuu dura Admin Sirna Addunyaa dhaabbata kana hojii irra oolchuu qaba.',
    ti: 'ሞጁላት ንግዲ ቅድሚ ምጥቃምኩም Global System Admin ነዚ ትካል ከንቅሖ ኣለዎ።',
    so: 'Maamulaha Nidaamka Caalamiga ahi waa inuu dhaqaajiyaa hay’addan ka hor inta aan la adeegsan qaybaha ganacsigeeda.',
    ar: 'يجب على مسؤول النظام العالمي تفعيل هذا الكيان قبل استخدام وحدات أعماله.',
    sw: 'Msimamizi wa Mfumo wa Kimataifa lazima awashe shirika hili kabla moduli zake za biashara hazijatumika.',
  },
  'GLOBAL CONTROL PLANE': {
    am: 'ዓለም አቀፍ የቁጥጥር ማዕከል', om: 'BUUFATA TOʼANNOO ADDUNYAA', ti: 'ማእከል ቁጽጽር ዓለምለኻዊ', so: 'XARUNTA XAKAMAYNTA CAALAMIGA AH', ar: 'مركز التحكم العالمي', sw: 'KITOVU CHA UDHIBITI WA KIMATAIFA',
  },
  'Tenant data administration': {
    am: 'የተከራይ ውሂብ አስተዳደር', om: 'Bulchiinsa daataa tenant', ti: 'ምምሕዳር ዳታ ተናንት', so: 'Maamulka xogta kiraystaha', ar: 'إدارة بيانات المستأجر', sw: 'Usimamizi wa data ya mpangaji',
  },
  'Global Admin assigns tenant-scoped Database Admin and Analytics Admin capability records to active eligible accounts. These assignments grant no platform database connection, SQL console, tenant database access, credential access, or change execution. Tenant operators remain responsible for their own data plane.': {
    am: 'ግሎባል አስተዳዳሪ ለንቁና ብቁ መለያዎች የተከራይ-ወሰን ያላቸውን የውሂብ ጎታ አስተዳዳሪና የትንታኔ አስተዳዳሪ ችሎታዎች ይመድባል። እነዚህ ምደባዎች የመድረክ ውሂብ ጎታ ግንኙነት፣ SQL ኮንሶል፣ የተከራይ ውሂብ ጎታ መዳረሻ፣ የምስጢር መዳረሻ ወይም ለውጥ ማስኬድ አይሰጡም። የተከራይ ኦፕሬተሮች የራሳቸውን የውሂብ አካባቢ ይቆጣጠራሉ።',
    om: 'Admin Addunyaa herrega hojii irra jiru fi ulaagaa guuteef dandeettii Bulchaa Kuusdeetaa fi Bulchaa Xiinxalaa daangaa tenant keessatti ramada. Ramaddiin kun walqabsiisa kuusdeetaa waltajjii, konsoolii SQL, seensa kuusdeetaa tenant, seensa ragaa iccitii yookaan raawwii jijjiirraa hin kennu. Ogeeyyiin tenant lafa daataa isaanii mataa isaanii itti gaafatamu.',
    ti: 'Global Admin ንንጡፋትን ብቑዓትን ሕሳባት ብወሰን ተናንት ዝተወሰኑ ሓላፊ ዳታቤዝን ሓላፊ ትንተናን ይምድብ። እዞም ምደባታት ምርኻብ ዳታቤዝ መድረኽ፣ ኮንሶል SQL፣ መእተዊ ዳታቤዝ ተናንት፣ መእተዊ ምስጢራት ወይ ምፍጻም ለውጢ ኣይህቡን። ኦፐሬተራት ተናንት ናይ ገዛእ ርእሶም ዳታ ይሓልዉ።',
    so: 'Global Admin wuxuu akoonnada firfircoon ee u qalma u qoondeeyaa awoodaha Database Admin iyo Analytics Admin ee ku kooban kiraystaha. Meelayntani ma bixiso isku-xirka xogta madasha, konsole SQL, gelitaanka xogta kiraystaha, aqoonsiyada sirta ah ama fulinta isbeddel. Hawl-wadeennada kiraystuhu iyagaa mas’uul ka ah xogtooda.',
    ar: 'يعيّن المسؤول العام سجلات صلاحيات مسؤول قاعدة البيانات ومسؤول التحليلات ضمن نطاق المستأجر للحسابات النشطة المؤهلة. لا تمنح هذه التعيينات اتصالًا بقاعدة بيانات المنصة أو وحدة SQL أو وصولًا لقاعدة بيانات المستأجر أو بيانات الاعتماد أو تنفيذ التغييرات. يظل مشغلو المستأجر مسؤولين عن بيئة بياناتهم.',
    sw: 'Global Admin hukabidhi uwezo wa Database Admin na Analytics Admin wenye mipaka ya mpangaji kwa akaunti hai zinazostahili. Ugawaji huo hautoi muunganisho wa hifadhidata ya jukwaa, dashibodi ya SQL, ufikiaji wa hifadhidata ya mpangaji, vitambulisho vya siri au utekelezaji wa mabadiliko. Waendeshaji wa mpangaji wanawajibika kwa mazingira yao ya data.',
  },
  'Tenant control-plane metadata is unavailable. Retry the workspace connection; no status is inferred.': {
    am: 'የተከራይ የቁጥጥር ማዕከል ዳታ አይገኝም። የሥራ ቦታ ግንኙነቱን እንደገና ይሞክሩ፤ ሁኔታ አይገመትም።',
    om: 'Metadaataan buufata toʼannoo tenant hin argamu. Walqunnamtii iddoo hojii irra deebiʼaa; haalli kamiyyuu hin tilmaamamu.',
    ti: 'Metadaataa buufata toʼannoo tenant ኣይርከብን። ርክብ ቦታ ስራሕ ደጊምኩም ፈትኑ፤ ኩነታት ኣይግመትን።',
    so: 'Xogta xakamaynta kiraystaha lama heli karo. Dib u tijaabi isku-xirka goobta shaqada; xaalad lama qiyaasayo.',
    ar: 'بيانات التحكم الخاصة بالمستأجر غير متاحة. أعد محاولة اتصال مساحة العمل؛ لن يُستنتج أي وضع.',
    sw: 'Metadata ya kitovu cha udhibiti wa mpangaji haipatikani. Jaribu tena muunganisho wa eneo la kazi; hakuna hali inayokisiwa.',
  },
  'Select an active tenant': {
    am: 'ንቁ ተከራይ ይምረጡ', om: 'Tenant hojii irra jiru filadhaa', ti: 'ንጡፍ ተናንት ምረጹ', so: 'Dooro kirayste firfircoon', ar: 'اختر مستأجرًا نشطًا', sw: 'Chagua mpangaji aliye hai',
  },
  'Select an active tenant first': {
    am: 'መጀመሪያ ንቁ ተከራይ ይምረጡ', om: 'Jalqaba tenant hojii irra jiru filadhaa', ti: 'መጀመርታ ንጡፍ ተናንት ምረጹ', so: 'Marka hore dooro kirayste firfircoon', ar: 'اختر مستأجرًا نشطًا أولًا', sw: 'Kwanza chagua mpangaji aliye hai',
  },
  'Tenant-scoped capability': {
    am: 'በተከራይ ወሰን የተገደበ ችሎታ', om: 'Dandeettii daangaa tenant qabu', ti: 'ብወሰን ተናንት ዝተወሰነ ክእለት', so: 'Awood ku kooban kiraystaha', ar: 'صلاحية محدودة بالمستأجر', sw: 'Uwezo wenye mipaka ya mpangaji',
  },
  'Loading eligible accounts…': {
    am: 'ብቁ መለያዎችን በመጫን ላይ…', om: 'Herrega ulaagaa guutan feʼaa jira…', ti: 'ሕሳባት ብቑዓት ይጽዓኑ ኣለዉ…', so: 'Waxaa la soo rarayaa akoonnada u qalma…', ar: 'جارٍ تحميل الحسابات المؤهلة…', sw: 'Inapakia akaunti zinazostahili…',
  },
  'Choose an active eligible account': {
    am: 'ንቁና ብቁ መለያ ይምረጡ', om: 'Herrega hojii irra jiru kan ulaagaa guute filadhaa', ti: 'ንጡፍን ብቑዕን ሕሳብ ምረጹ', so: 'Dooro akoon firfircoon oo u qalma', ar: 'اختر حسابًا نشطًا مؤهلًا', sw: 'Chagua akaunti hai inayostahili',
  },
  'Could not load eligible accounts': {
    am: 'ብቁ መለያዎችን መጫን አልተቻለም', om: 'Herrega ulaagaa guutan feʼuun hin dandaʼamne', ti: 'ሕሳባት ብቑዓት ምጽዓን ኣይተኻእለን', so: 'Lama soo rarik karin akoonnada u qalma', ar: 'تعذر تحميل الحسابات المؤهلة', sw: 'Imeshindwa kupakia akaunti zinazostahili',
  },
  'Current assignments': {
    am: 'አሁን ያሉ ምደባዎች', om: 'Ramaddiiwwan amma jiran', ti: 'ሕጂ ዘለዉ ምደባታት', so: 'Meelaynta hadda jirta', ar: 'التعيينات الحالية', sw: 'Ugawaji wa sasa',
  },
  'No Database Admin or Analytics Admin capability is assigned.': {
    am: 'የውሂብ ጎታ አስተዳዳሪ ወይም የትንታኔ አስተዳዳሪ ችሎታ አልተመደበም።',
    om: 'Dandeettiin Bulchaa Kuusdeetaa yookaan Bulchaa Xiinxalaa hin ramadamne.',
    ti: 'ክእለት ሓላፊ ዳታቤዝ ወይ ሓላፊ ትንተና ኣይተመደበን።',
    so: 'Lama meelayn awoodda Database Admin ama Analytics Admin.',
    ar: 'لم يتم تعيين صلاحية مسؤول قاعدة البيانات أو مسؤول التحليلات.',
    sw: 'Hakuna uwezo wa Database Admin au Analytics Admin uliogawiwa.',
  },
  'Operator readiness checklists (manual evidence only)': {
    am: 'የኦፕሬተር ዝግጁነት ዝርዝሮች (በእጅ የሚዘጋጅ ማስረጃ ብቻ)', om: 'Tarree qophii ogeessaa (ragaa harkaan galmaaʼe qofa)', ti: 'ዝርዝር ድልውነት ኦፐሬተር (መርትዖ ብኢድ ጥራይ)', so: 'Liisaska hubinta diyaarinta hawl-wadeenka (caddayn gacanta oo keliya)', ar: 'قوائم جاهزية المشغّل (أدلة يدوية فقط)', sw: 'Orodha za ukaguzi wa utayari wa mwendeshaji (ushahidi wa mikono pekee)',
  },
  'Migration review': {
    am: 'የማሻሻያ ግምገማ', om: 'Gamaaggama jijjiirraa', ti: 'ግምገማ ምስግጋር', so: 'Dib-u-eegista guurista', ar: 'مراجعة الترحيل', sw: 'Ukaguzi wa uhamishaji',
  },
  'Confirm tenant-local maintenance window and approved release; compare migration manifest and checksums; verify a tenant-local backup and restore-tested recovery point; run migrations only with that tenant’s approved operator process; capture before/after schema and readiness evidence; record rollback outcome. This panel does not run or validate those steps.': {
    am: 'በተከራዩ አካባቢ የጥገና ጊዜንና የጸደቀ ልቀትን ያረጋግጡ፤ የማሻሻያ ዝርዝርና የቼክሰም እሴቶችን ያነጻጽሩ፤ የተከራይ ባክአፕንና በመመለስ የተፈተነ የመመለሻ ነጥብን ያረጋግጡ፤ ማሻሻያዎችን በዚያ ተከራይ የጸደቀ ኦፕሬተር ሂደት ብቻ ያስኪዱ፤ ከማስኬዱ በፊትና በኋላ የስኪማና የዝግጁነት ማስረጃ ይመዝግቡ፤ የመመለሻ ውጤትን ያስመዝግቡ። ይህ ፓነል እነዚህን አያስኬድም ወይም አያረጋግጥም።',
    om: 'Yeroo suphaa tenant keessaa fi gadhiinsa raggaʼe mirkaneessaa; tarree migration fi checksum walbira qabaa; backup tenant keessaa fi bakka deebiʼanii yaalamu mirkaneessaa; migration adeemsa ogeessaa tenant sanaatiin raggaʼe qofa fayyadamaa; ragaa schema fi qophii dura/booda galmeessaa; buʼaa deebii duubaa galmeessaa. Paaneeliin kun tarkaanfii kana hin raawwatu yookaan hin mirkaneessu.',
    ti: 'ኣብቲ ተናንት ዘሎ ናይ ጽገና ግዜን ዝተፈቕደ ምርካብን ኣረጋግጹ፤ ዝርዝር migrationን checksumን ኣነጻጽሩ፤ ባክኣፕ ተናንትን ብምምላስ ዝተፈተነ ነጥቢ ምድሓንን ኣረጋግጹ፤ migration ብዝተፈቕደ መስርሕ ኦፐሬተር ተናንት ጥራይ ኣካይዱ፤ ቅድሚን ድሕሪን schemaን ድልውነትን መርትዖ መዝግቡ፤ ውጽኢት ምምላስ መዝግቡ። እዚ ፓነል እቶም ስጉምትታት ኣየካይድን ወይ ኣየረጋግጽን።',
    so: 'Xaqiiji waqtiga dayactirka ee kiraystaha iyo sii-daynta la ansixiyey; isbarbar dhig liiska guurista iyo checksums-ka; xaqiiji kaydka kiraystaha iyo barta soo-kabashada ee dib-u-soo-celinta lagu tijaabiyey; guurista ku samee oo keliya habka hawl-wadeenka ee kiraystaha ansixiyey; qor caddaynta schema iyo u-diyaargarowga ka hor/kadib; diiwaangeli natiijada dib-u-celinta. Qaybtani tallaabooyinkaas ma fuliso mana xaqiijiso.',
    ar: 'تحقق من نافذة الصيانة المحلية للمستأجر والإصدار المعتمد؛ وقارن بيان الترحيل وقيم التحقق؛ وتحقق من النسخة الاحتياطية ونقطة الاستعادة التي اختُبرت استعادتها؛ ونفّذ الترحيل عبر عملية المشغّل المعتمدة لذلك المستأجر فقط؛ وسجّل أدلة المخطط والجاهزية قبل التنفيذ وبعده ونتيجة التراجع. لا تنفّذ هذه اللوحة الخطوات ولا تتحقق منها.',
    sw: 'Thibitisha dirisha la matengenezo la mpangaji na toleo lililoidhinishwa; linganisha orodha ya uhamishaji na checksums; hakiki nakala rudufu ya mpangaji na sehemu ya urejeshaji iliyojaribiwa; endesha uhamishaji kwa utaratibu wa mwendeshaji ulioidhinishwa wa mpangaji huyo pekee; hifadhi ushahidi wa schema na utayari kabla/baada; rekodi matokeo ya kurejesha. Paneli hii haitekelezi wala kuthibitisha hatua hizo.',
  },
  'Backup / restore review': {
    am: 'የባክአፕ / መመለሻ ግምገማ', om: 'Gamaaggama backup / deebisuu', ti: 'ግምገማ ባክኣፕ / ምምላስ', so: 'Dib-u-eegista kaydinta/soo-celinta', ar: 'مراجعة النسخ الاحتياطي والاستعادة', sw: 'Ukaguzi wa nakala rudufu / urejeshaji',
  },
  'Confirm tenant-local backup policy, encryption and retention; record last successful backup timestamp and immutable evidence reference; verify restore into an isolated tenant-controlled environment; perform integrity and application checks; document recovery objectives and operator sign-off. No backup, restore, or database change is triggered here.': {
    am: 'በተከራዩ አካባቢ ያለውን የባክአፕ ፖሊሲ፣ ምስጠራና የማቆያ ጊዜ ያረጋግጡ፤ የመጨረሻውን የተሳካ ባክአፕ ጊዜና የማይለወጥ የማስረጃ ማጣቀሻ ይመዝግቡ፤ ወደ ተለየ በተከራይ ቁጥጥር ሥር ባለ አካባቢ መመለሱን ያረጋግጡ፤ የታማኝነትና የመተግበሪያ ምርመራ ያድርጉ፤ የመመለሻ ግቦችንና የኦፕሬተር ማጽደቅን ይመዝግቡ። እዚህ ባክአፕ፣ መመለስ ወይም የውሂብ ጎታ ለውጥ አይጀመርም።',
    om: 'Imaammata backup tenant keessaa, iccitii fi yeroo kuusaa mirkaneessaa; yeroo backup milkaaʼe isa dhumaa fi wabii ragaa hin jijjiiramne galmeessaa; gara naannoo adda baafamee tenantiin toʼatamutti deebisuu mirkaneessaa; qulqullina fi hojii app sakattaʼaa; galma deebisuu fi mallattoo ogeessaa galmeessaa. Asitti backup, deebisuu yookaan jijjiirraan kuusdeetaa hin jalqabu.',
    ti: 'ፖሊሲ ባክኣፕ ተናንት፣ ምስጠራን ግዜ ምዕቃብን ኣረጋግጹ፤ ናይ መወዳእታ ዝተዓወተ ባክኣፕ ግዜን ዘይቅየር መወከሲ መርትዖን መዝግቡ፤ ናብ ፍሉይ ብተናንት ዝቆጻጸር ከባቢ ምምላስ ኣረጋግጹ፤ ቅንዕናን መተግበሪን መርምሩ፤ ዕላማታት ምምላስን ምጽዳቕ ኦፐሬተርን ሰንዱ። ኣብዚ ባክኣፕ፣ ምምላስ ወይ ለውጢ ዳታቤዝ ኣይጅምርን።',
    so: 'Xaqiiji siyaasadda kaydka, sirgelinta iyo muddada haynta ee kiraystaha; qor wakhtigii ugu dambeeyey ee kayd guulaystay iyo tixraac caddayn oo aan la beddeli karin; hubi in lagu soo celiyo deegaan gooni ah oo kiraystuhu maamulo; samee hubinta saxnaanta iyo barnaamijka; diiwaangeli yoolalka soo-kabashada iyo saxeexa hawl-wadeenka. Halkan lagama bilaabayo kaydin, soo-celin ama isbeddel xogeed.',
    ar: 'تحقق من سياسة النسخ الاحتياطي والتشفير والاحتفاظ لدى المستأجر؛ وسجّل وقت آخر نسخة ناجحة ومرجع الدليل غير القابل للتغيير؛ وتحقق من الاستعادة في بيئة معزولة يديرها المستأجر؛ وافحص سلامة البيانات والتطبيق؛ ووثّق أهداف الاستعادة واعتماد المشغّل. لا يبدأ هنا نسخ احتياطي أو استعادة أو تغيير لقاعدة البيانات.',
    sw: 'Thibitisha sera ya nakala rudufu, usimbaji fiche na muda wa kuhifadhi wa mpangaji; rekodi muda wa nakala ya mwisho iliyofaulu na rejeleo lisilobadilika la ushahidi; hakiki urejeshaji katika mazingira tofauti yanayodhibitiwa na mpangaji; fanya ukaguzi wa uadilifu na programu; andika malengo ya urejeshaji na idhini ya mwendeshaji. Hakuna nakala, urejeshaji au mabadiliko ya hifadhidata yanayoanzishwa hapa.',
  },
  'Create an audited operator request (no execution)': {
    am: 'የኦፕሬተር ጥያቄ ይፍጠሩ (በኦዲት ይመዝገባል፣ አይፈጸምም)', om: 'Gaaffii ogeessaa odiitii qabu uumaa (hin raawwatamu)', ti: 'ሕቶ ኦፐሬተር ብኦዲት ዝምዝገብ ፍጠሩ (ኣይፍጸምን)', so: 'Abuur codsi hawl-wadeen oo la diiwaangeliyo (lama fulinayo)', ar: 'أنشئ طلب مشغّل خاضعًا للتدقيق (دون تنفيذ)', sw: 'Unda ombi la mwendeshaji linalokaguliwa (halitekelezwi)',
  },
  'Recent operator requests': {
    am: 'የቅርብ ጊዜ የኦፕሬተር ጥያቄዎች', om: 'Gaaffiiwwan ogeessaa dhiheenyaa', ti: 'ሕቶታት ኦፐሬተር ናይ ቀረባ ግዜ', so: 'Codsiyadii ugu dambeeyey ee hawl-wadeenka', ar: 'طلبات المشغّلين الأخيرة', sw: 'Maombi ya hivi karibuni ya waendeshaji',
  },
  'No operational requests are recorded. Creating a request never executes a database change.': {
    am: 'ምንም የሥራ ጥያቄ አልተመዘገበም። ጥያቄ መፍጠር የውሂብ ጎታ ለውጥን አያስኬድም።',
    om: 'Gaaffiin hojii hin galmoofne. Gaaffii uumuun jijjiirraa kuusdeetaa matumaa hin raawwatu.',
    ti: 'ዝኾነ ሕቶ ስራሕ ኣይተመዝገበን። ሕቶ ምፍጣር ለውጢ ዳታቤዝ ፈጺሙ ኣየካይድን።',
    so: 'Wax codsiyo hawlgal ah lama diiwaangelin. Abuurista codsi waligeed ma fuliso isbeddel xogeed.',
    ar: 'لا توجد طلبات تشغيلية مسجلة. إنشاء الطلب لا ينفّذ أي تغيير في قاعدة البيانات.',
    sw: 'Hakuna maombi ya uendeshaji yaliyorekodiwa. Kuunda ombi hakutekelezi mabadiliko ya hifadhidata.',
  },
  'Service identity inventory': {
    am: 'የአገልግሎት መለያ ዝርዝር', om: 'Tarree eenyummaa tajaajilaa', ti: 'ዝርዝር መንነት ኣገልግሎት', so: 'Diiwaanka aqoonsiga adeegga', ar: 'سجل هويات الخدمات', sw: 'Orodha ya utambulisho wa huduma',
  },
  'Record vault references and rotation evidence only. Never enter credential values or tokens. Rotation and retirement require a different platform administrator from the identity creator.': {
    am: 'የማከማቻ ማጣቀሻዎችንና የማዞሪያ ማስረጃን ብቻ ይመዝግቡ። የምስጢር መለያ ወይም ቶከን አያስገቡ። ማዞርና ማቋረጥ ከመለያው ፈጣሪ የተለየ የመድረክ አስተዳዳሪ ይፈልጋሉ።',
    om: 'Wabii kuusaa fi ragaa marsaa jijjiirraa qofa galmeessaa. Gatii ragaa iccitii yookaan token matumaa hin galchinaa. Marsaa jijjiirraa fi dhaabuun bulchaa waltajjii nama eenyummaa uume irraa adda taʼe barbaada.',
    ti: 'መወከሲ ቮልትን መርትዖ ምቕያርን ጥራይ መዝግቡ። እሴታት ምስጢር ወይ token ፈጺምኩም ኣይተእትዉ። ምቕያርን ምቁራጽን ካብቲ መንነት ዝፈጠረ ዝተፈልየ ምምሕዳር መድረኽ ይሓትት።',
    so: 'Diiwaangeli oo keliya tixraacyada kaydka sirta ah iyo caddaynta beddelka. Waligaa ha gelin qiimaha aqoonsiga sirta ah ama token-ka. Beddelka iyo hawlgab ka dhigistu waxay u baahan yihiin maamule madal oo ka duwan kii aqoonsiga sameeyey.',
    ar: 'سجّل مراجع الخزنة وأدلة التدوير فقط. لا تُدخل قيم بيانات الاعتماد أو الرموز أبدًا. يتطلب التدوير والإيقاف مسؤول منصة مختلفًا عن منشئ الهوية.',
    sw: 'Rekodi marejeo ya hifadhi salama na ushahidi wa kubadilisha siri pekee. Usiweke thamani za kitambulisho au tokeni kamwe. Kubadilisha na kusitisha kunahitaji msimamizi tofauti na aliyeunda utambulisho huo.',
  },
  'No named owner': {
    am: 'የተጠቀሰ ባለቤት የለም', om: 'Abbaan maqaan hin ibsamne', ti: 'ዝተጠቕሰ ዋና የለን', so: 'Ma jiro milkiile la magacaabay', ar: 'لا يوجد مالك محدد بالاسم', sw: 'Hakuna mmiliki aliyetajwa',
  },
  'No territory': {
    am: 'አካባቢ የለም', om: 'Naannoon hin jiru', ti: 'ከባቢ የለን', so: 'Goob lama cayimin', ar: 'لا توجد منطقة', sw: 'Hakuna eneo',
  },
  'Choose master agent': {
    am: 'ዋና ወኪል ይምረጡ', om: 'Bakka buʼaa olaanaa filadhaa', ti: 'ዋና ወኪል ምረጹ', so: 'Dooro wakiilka guud', ar: 'اختر وكيلًا رئيسيًا', sw: 'Chagua wakala mkuu',
  },
  'Plan requested': {
    am: 'የታቀደው እቅድ', om: 'Karoora gaafatame', ti: 'ውጥን ዝተሓተተ', so: 'Qorshaha la codsaday', ar: 'الخطة المطلوبة', sw: 'Mpango ulioombwa',
  },
  'Payment not configured': {
    am: 'ክፍያ አልተዋቀረም', om: 'Kaffaltiin hin qindaaʼin', ti: 'ክፍሊት ኣይተዳለወን', so: 'Lacag-bixinta lama dejin', ar: 'لم يتم إعداد الدفع', sw: 'Malipo hayajasanidiwa',
  },
  'Platform snapshot': {
    am: 'የመድረክ አጭር ሁኔታ', om: 'Cuunfaa waltajjii', ti: 'ሓፈሻዊ ርእይቶ መድረኽ', so: 'Muuqaalka madasha', ar: 'لمحة عن المنصة', sw: 'Muhtasari wa jukwaa',
  },
  'Set a new password': {
    am: 'አዲስ የይለፍ ቃል ያዘጋጁ', om: 'Jecha icciitii haaraa qopheessaa', ti: 'ሓድሽ መሕለፊ ቃል ኣዳልዉ', so: 'Samee eray sir cusub', ar: 'عيّن كلمة مرور جديدة', sw: 'Weka nenosiri jipya',
  },
  'Your account requires a password change before continuing.': {
    am: 'ከመቀጠልዎ በፊት የይለፍ ቃልዎን መቀየር ያስፈልጋል።', om: 'Itti fufuuf jecha icciitii keessan jijjiiruun barbaachisa.', ti: 'ቅድሚ ምቕጻልኩም መሕለፊ ቃልኩም ክትቅይሩ የድሊ።', so: 'Waa inaad beddeshaa eraygaaga sirta ah ka hor intaadan sii wadin.', ar: 'يجب تغيير كلمة المرور قبل المتابعة.', sw: 'Lazima ubadilishe nenosiri kabla ya kuendelea.',
  },
  'Add this account in your authenticator app using the setup key below.': {
    am: 'ከታች ያለውን የማዋቀሪያ ቁልፍ በመጠቀም ይህን መለያ ወደ ማረጋገጫ መተግበሪያዎ ያክሉ።',
    om: 'Furtuu qindeessaa armaan gadii fayyadamuun herrega kana appii mirkaneessaa keessan keessatti dabalaa.',
    ti: 'Furtuu qindeessuu armaan gadii fayyadamuun ነዚ ሕሳብ ናብ መተግበሪ መረጋገጺኹም ወስኹ።',
    so: 'Akoonkan ku dar abka xaqiijinta adigoo adeegsanaya furaha dejinta ee hoose.',
    ar: 'أضف هذا الحساب إلى تطبيق المصادقة باستخدام مفتاح الإعداد أدناه.',
    sw: 'Ongeza akaunti hii kwenye programu yako ya uthibitishaji kwa kutumia ufunguo wa usanidi ulio hapa chini.',
  },
  'Rows per page': {
    am: 'በአንድ ገጽ ያሉ ረድፎች', om: 'Tarree fuula tokko keessatti', ti: 'ረድፍ ኣብ ሓደ ገጽ', so: 'Safafka bog kasta', ar: 'الصفوف في الصفحة', sw: 'Safu kwa kila ukurasa',
  },
  'No rows': {
    am: 'ምንም ረድፍ የለም', om: 'Tarreen hin jiru', ti: 'ዝኾነ ረድፊ የለን', so: 'Safaf ma jiraan', ar: 'لا توجد صفوف', sw: 'Hakuna safu',
  },
  'Eligible candidates': {
    am: 'ብቁ እጩዎች', om: 'Kaadhimamtoota ulaagaa guutan', ti: 'ብቑዓት ሕጹያት', so: 'Musharraxiinta u qalma', ar: 'المرشحون المؤهلون', sw: 'Wagombea wanaostahili',
  },
  'Scores are recommendations based on the factors below. A staff member reviews each proposal. Confirm the worker’s willingness and terms directly before reserving.': {
    am: 'ውጤቶቹ ከታች ባሉት ሁኔታዎች ላይ የተመሠረቱ ምክሮች ናቸው። ሠራተኛ እያንዳንዱን ሐሳብ ይገመግማል። ከመያዝዎ በፊት የሠራተኛውን ፈቃደኝነትና ውሎች በቀጥታ ያረጋግጡ።',
    om: 'Qabxiileen gorsa wantoota armaan gadii irratti hundaaʼani. Hojjetaan tokko yaada tokkoon tokkoo gamaaggama. Osoo hin qabsiisin dura fedhii fi haalota hojjetaa kallattiin mirkaneessaa.',
    ti: 'እቶም ነጥብታት ኣብቶም ኣብ ታሕቲ ዘለዉ ረቛሒታት ዝተመርኮሱ ሓሳባት እዮም። ሰራሕተኛ ነፍሲ ወከፍ ሓሳብ ይግምግም። ቅድሚ ምሓዝኩም ፍቓድን ውዕላትን ሰራሕተኛ ብቐጥታ ኣረጋግጹ።',
    so: 'Dhibcuhu waa talooyin ku salaysan qodobada hoose. Shaqaale ayaa eegaya soo-jeedin kasta. Si toos ah u xaqiiji rabitaanka shaqaalaha iyo shuruudaha ka hor boos-qabsiga.',
    ar: 'الدرجات توصيات تستند إلى العوامل أدناه. يراجع الموظفون كل مقترح. تحقّق مباشرةً من موافقة العامل وشروطه قبل الحجز.',
    sw: 'Alama ni mapendekezo yanayotegemea vipengele vilivyo hapa chini. Mfanyakazi hukagua kila pendekezo. Thibitisha moja kwa moja ridhaa na masharti ya mfanyakazi kabla ya kuhifadhi nafasi.',
  },
  'Score factors': {
    am: 'የውጤት ሁኔታዎች', om: 'Wantoota qabxii', ti: 'ረቛሒታት ነጥቢ', so: 'Qodobbada dhibcaha', ar: 'عوامل التقييم', sw: 'Vipengele vya alama',
  },
  'Breakdown unavailable for this earlier match.': {
    am: 'ለዚህ የቀድሞ ማዛመድ ዝርዝር ክፍፍል አይገኝም።', om: 'Qoodinsiin walsimannaa duraanii kanaaf hin jiru.', ti: 'ዝርዝር ነጥቢ ናይዚ ቀደም ዝበለ ምዝማድ ኣይርከብን።', so: 'Faahfaahinta kulankan hore lama heli karo.', ar: 'تفاصيل هذا التطابق السابق غير متاحة.', sw: 'Uchanganuzi wa ulinganifu huu wa awali haupatikani.',
  },
  'Eligibility and scoring policy': {
    am: 'የብቁነትና የውጤት ፖሊሲ', om: 'Imaammata ulaagaa fi qabxii', ti: 'ፖሊሲ ብቕዓትን ነጥብን', so: 'Siyaasadda u-qalmitaanka iyo dhibcaha', ar: 'سياسة الأهلية والتقييم', sw: 'Sera ya ustahiki na alama',
  },
  'Evaluation details are unavailable for this record.': {
    am: 'ለዚህ መዝገብ የግምገማ ዝርዝሮች አይገኙም።', om: 'Balʼinni madaallii galmee kanaaf hin jiru.', ti: 'ዝርዝር ግምገማ ናይዚ መዝገብ ኣይርከብን።', so: 'Faahfaahinta qiimaynta diiwaankan lama heli karo.', ar: 'تفاصيل التقييم غير متاحة لهذا السجل.', sw: 'Maelezo ya tathmini ya rekodi hii hayapatikani.',
  },
  'Proposed matches': {
    am: 'የቀረቡ ማዛመጃዎች', om: 'Walsimsiisa dhiyaatan', ti: 'ምዝማዳት ዝቐረቡ', so: 'Is-waafajinta la soo jeediyey', ar: 'التطابقات المقترحة', sw: 'Ulinganifu uliopendekezwa',
  },
  'Prepare engagement terms': {
    am: 'የሥራ ተሳትፎ ውሎችን ያዘጋጁ', om: 'Haalota bobbaʼinsa hojii qopheessaa', ti: 'ውዕላት ተሳትፎ ስራሕ ኣዳልዉ', so: 'Diyaari shuruudaha hawlgelinta', ar: 'أعد شروط الارتباط بالعمل', sw: 'Andaa masharti ya ushiriki wa kazi',
  },
  'Finance independently reviews these terms. They do not create payroll or ledger entries.': {
    am: 'ፋይናንስ እነዚህን ውሎች በገለልተኛ ሁኔታ ይገመግማል። የደመወዝ ወይም የሂሳብ መዝገብ አይፈጥሩም።',
    om: 'Faayinaansiin haalota kana of dandaʼee gamaaggama. Galmee mindaa yookaan herregaa hin uuman.',
    ti: 'ፋይናንስ ነዞም ውዕላት ብናጻ ይግምግሞም። መዝገብ ደሞዝ ወይ ሒሳብ ኣይፈጥሩን።',
    so: 'Maaliyaddu si madax-bannaan ayay u eegaysaa shuruudahan. Ma abuuraan mushahar-bixin ama gelinno xisaabeed.',
    ar: 'تراجع الإدارة المالية هذه الشروط بشكل مستقل. ولا تنشئ مسيرات رواتب أو قيودًا محاسبية.',
    sw: 'Fedha hukagua masharti haya kwa uhuru. Hayaundi malipo ya mishahara au maingizo ya daftari.',
  },
  'Submit completed work evidence': {
    am: 'የተጠናቀቀ ሥራ ማስረጃ ያቅርቡ', om: 'Ragaa hojii xumurame dhiyeessaa', ti: 'መርትዖ ስራሕ ዝተዛዘመ ኣቕርቡ', so: 'Gudbi caddaynta shaqada la dhammeeyey', ar: 'أرسل دليل إتمام العمل', sw: 'Wasilisha ushahidi wa kazi iliyokamilika',
  },
  'Worker documents': {
    am: 'የሠራተኛ ሰነዶች', om: 'Sanadoota hojjetaa', ti: 'ሰነዳት ሰራሕተኛ', so: 'Dukumentiyada shaqaalaha', ar: 'مستندات العامل', sw: 'Hati za mfanyakazi',
  },
  'not specified': {
    am: 'አልተገለጸም', om: 'Hin ibsamne', ti: 'ኣይተገልጸን', so: 'Lama cayimin', ar: 'غير محدد', sw: 'Haijabainishwa',
  },
  'Upload identity document': {
    am: 'የመታወቂያ ሰነድ ይጫኑ', om: 'Sanada eenyummaa olkaaʼaa', ti: 'ሰነድ መንነት ጽዓኑ', so: 'Soo geli dukumentiga aqoonsiga', ar: 'ارفع مستند الهوية', sw: 'Pakia hati ya utambulisho',
  },
  'Property photos & video': {
    am: 'የንብረት ፎቶዎችና ቪዲዮ', om: 'Suuraa fi viidiyoo qabeenyaa', ti: 'ስእልን ቪድዮን ንብረት', so: 'Sawirrada iyo muuqaalka hantida', ar: 'صور العقار ومقاطع الفيديو', sw: 'Picha na video za nyumba',
  },
  'Property video': {
    am: 'የንብረት ቪዲዮ', om: 'Viidiyoo qabeenyaa', ti: 'ቪድዮ ንብረት', so: 'Muuqaalka hantida', ar: 'فيديو العقار', sw: 'Video ya nyumba',
  },
  'Property picture': {
    am: 'የንብረት ፎቶ', om: 'Suuraa qabeenyaa', ti: 'ስእሊ ንብረት', so: 'Sawirka hantida', ar: 'صورة العقار', sw: 'Picha ya nyumba',
  },
  'Add listing photos or video': {
    am: 'የዝርዝሩን ፎቶዎች ወይም ቪዲዮ ያክሉ', om: 'Suuraa yookaan viidiyoo tarree dabalaa', ti: 'ስእልታት ወይ ቪድዮ ዝርዝር ወስኹ', so: 'Ku dar sawirro ama muuqaal liiska', ar: 'أضف صورًا أو فيديو للإعلان', sw: 'Ongeza picha au video kwenye tangazo',
  },
  'Applicant KYC documents': {
    am: 'የአመልካች የKYC ሰነዶች', om: 'Sanadoota KYC kaadhimamaa', ti: 'ሰነዳት KYC ኣመልካቲ', so: 'Dukumentiyada KYC ee codsadaha', ar: 'مستندات KYC لمقدم الطلب', sw: 'Hati za KYC za mwombaji',
  },
  'Choose a JPEG/PNG image or MP4/WebM video.': {
    am: 'JPEG/PNG ምስል ወይም MP4/WebM ቪዲዮ ይምረጡ።', om: 'Suuraa JPEG/PNG yookaan viidiyoo MP4/WebM filadhaa.', ti: 'ስእሊ JPEG/PNG ወይ ቪድዮ MP4/WebM ምረጹ።', so: 'Dooro sawir JPEG/PNG ah ama muuqaal MP4/WebM ah.', ar: 'اختر صورة JPEG/PNG أو فيديو MP4/WebM.', sw: 'Chagua picha ya JPEG/PNG au video ya MP4/WebM.',
  },
  'This file exceeds the configured upload size limit.': {
    am: 'ይህ ፋይል የተዋቀረውን የመጫኛ መጠን ገደብ ይበልጣል።', om: 'Faayilli kun daangaa hamma olkaaʼinsaa qindaaʼe caala.', ti: 'እዚ ፋይል ካብ ዝተዳለወ ደረት ምጽዓን ይበልጽ።', so: 'Faylkani wuxuu ka weyn yahay xadka gelinta ee la dejiyey.', ar: 'يتجاوز هذا الملف الحد المحدد لحجم الرفع.', sw: 'Faili hii imezidi kikomo cha ukubwa wa upakiaji kilichowekwa.',
  },
  'Remove this Super Admin from the tenant? Their deployment access will end immediately.': {
    am: 'ይህን ሱፐር አስተዳዳሪ ከተከራዩ ያስወግዱ? የማሰማራት መዳረሻው ወዲያውኑ ያበቃል።', om: 'Super Admin kana tenant keessaa haa baasnuu? Seensi hojii irra oolmaa isaa battalumatti ni dhaabbata.', ti: 'ነዚ Super Admin ካብ tenant ነውጽኦ? መእተዊ ምስፋሕኡ ብኡንብኡ ይውዳእ።', so: 'Ma ka saaraysaa Super Admin-kan kiraystaha? Gelitaanka geyntiisu isla markiiba wuu dhammaanayaa.', ar: 'هل تريد إزالة هذا المسؤول الفائق من المستأجر؟ سينتهي وصوله إلى النشر فورًا.', sw: 'Umwondoe Msimamizi Mkuu huyu kwenye mpangaji? Ufikiaji wake wa mfumo wa mpangaji utaisha mara moja.',
  },
  'Enter retirement evidence (minimum 10 characters).': {
    am: 'የማቋረጥ ማስረጃ ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Ragaa dhaabuu galchaa (qubee yoo xiqqaate 10).', ti: 'መርትዖ ምቁራጽ ኣእትዉ (እንተወሓደ 10 ፊደላት)።', so: 'Geli caddaynta hawlgab-ka (ugu yaraan 10 xaraf).', ar: 'أدخل دليل الإيقاف (10 أحرف على الأقل).', sw: 'Weka ushahidi wa kusitisha (angalau herufi 10).',
  },
  'Lifecycle evidence': {
    am: 'የሕይወት ዑደት ማስረጃ', om: 'Ragaa marsaa jireenyaa', ti: 'መርትዖ ዑደት ህይወት', so: 'Caddaynta wareegga nolosha', ar: 'أدلة دورة الحياة', sw: 'Ushahidi wa mzunguko wa maisha',
  },
  'Archive this training item? It will no longer appear to audiences.': {
    am: 'ይህን የሥልጠና ንጥል ወደ ማህደር ያስገቡ? ከዚያ በኋላ ለተመልካቾች አይታይም።',
    om: 'Meeshaa leenjii kana kuusaa keessatti haa kaaʼuu? Sana booda dhaggeeffattootaaf hin mulʼatu.',
    ti: 'ነዚ ንጥል ስልጠና ኣብ ማህደር ንኣእትዎ? ድሕሪኡ ንተመልከትቲ ኣይርአን።',
    so: 'Ma kaydinaysaa shaygan tababarka? Mar dambe uma muuqan doono dadka loo bandhigo.',
    ar: 'هل تريد أرشفة هذا العنصر التدريبي؟ لن يظهر بعد ذلك للمشاهدين.',
    sw: 'Hifadhi kipengee hiki cha mafunzo? Hakitaonekana tena kwa hadhira.',
  },
  'Enter the payment reference.': {
    am: 'የክፍያ ማጣቀሻውን ያስገቡ።', om: 'Wabii kaffaltii galchaa.', ti: 'መወከሲ ክፍሊት ኣእትዉ።', so: 'Geli tixraaca lacag-bixinta.', ar: 'أدخل مرجع الدفع.', sw: 'Weka rejeleo la malipo.',
  },
  'Enter a reason (at least 10 characters).': {
    am: 'ምክንያት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sababa galchaa (qubee yoo xiqqaate 10).', ti: 'ምኽንያት ኣእትዉ (እንተወሓደ 10 ፊደላት)።', so: 'Geli sabab (ugu yaraan 10 xaraf).', ar: 'أدخل سببًا (10 أحرف على الأقل).', sw: 'Weka sababu (angalau herufi 10).',
  },
  'Enter why this pending receipt should be voided (at least 10 characters).': {
    am: 'ይህ በመጠባበቅ ላይ ያለ ደረሰኝ ለምን መሰረዝ እንዳለበት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Nagaheen eegaa jiru kun maaliif haqamuu akka qabu galchaa (qubee yoo xiqqaate 10).',
    ti: 'እዚ ዝጽበ ዘሎ ደረሰኝ ስለምንታይ ክስረዝ ከም ዘለዎ ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Sheeg sababta rasiidhkan sugaya loo burinayo (ugu yaraan 10 xaraf).',
    ar: 'أدخل سبب إلغاء هذا الإيصال المعلّق (10 أحرف على الأقل).',
    sw: 'Eleza kwa nini risiti hii inayosubiri inapaswa kufutwa (angalau herufi 10).',
  },
  'Enter the reason (at least 10 characters).': {
    am: 'ምክንያቱን ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sababa galchaa (qubee yoo xiqqaate 10).', ti: 'ምኽንያት ኣእትዉ (እንተወሓደ 10 ፊደላት)።', so: 'Geli sababta (ugu yaraan 10 xaraf).', ar: 'أدخل السبب (10 أحرف على الأقل).', sw: 'Weka sababu (angalau herufi 10).',
  },
  'Enter the execution reason (at least 10 characters).': {
    am: 'የፈጻሚነት ምክንያቱን ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sababa raawwii galchaa (qubee yoo xiqqaate 10).', ti: 'ምኽንያት ምፍጻም ኣእትዉ (እንተወሓደ 10 ፊደላት)።', so: 'Geli sababta fulinta (ugu yaraan 10 xaraf).', ar: 'أدخل سبب التنفيذ (10 أحرف على الأقل).', sw: 'Weka sababu ya utekelezaji (angalau herufi 10).',
  },
  'Enter the possession handover date (YYYY-MM-DD).': {
    am: 'የይዞታ ርክክብ ቀን ያስገቡ (YYYY-MM-DD)።', om: 'Guyyaa dabarsa qabiyyee galchaa (YYYY-MM-DD).', ti: 'ዕለት ርክክብ ይዞታ ኣእትዉ (YYYY-MM-DD)።', so: 'Geli taariikhda wareejinta hantida (YYYY-MM-DD).', ar: 'أدخل تاريخ تسليم الحيازة (YYYY-MM-DD).', sw: 'Weka tarehe ya kukabidhi umiliki (YYYY-MM-DD).',
  },
  'Confirm that the move-in inspection is complete and the handover date is correct.': {
    am: 'የመግቢያ ምርመራው መጠናቀቁንና የርክክብ ቀኑ ትክክል መሆኑን ያረጋግጡ።',
    om: 'Sakattaʼiinsi seensaa xumuramuu fi guyyaan dabarsaa sirrii taʼuu mirkaneessaa.',
    ti: 'ምርመራ ምእታው ምዝዛሙን ዕለት ርክክብ ቅኑዕ ምዃኑን ኣረጋግጹ።',
    so: 'Xaqiiji in kormeerka gelitaanku dhammaaday iyo in taariikhda wareejintu sax tahay.',
    ar: 'أكد اكتمال فحص الانتقال وصحة تاريخ التسليم.',
    sw: 'Thibitisha kuwa ukaguzi wa kuhamia umekamilika na tarehe ya makabidhiano ni sahihi.',
  },
  'End this lease? Future rent charges will be waived.': {
    am: 'ይህን የኪራይ ውል ያቋርጡ? የወደፊት የኪራይ ክፍያዎች ይሰረዛሉ።', om: 'Waliigaltee kiraa kana haa xumurnu? Kaffaltiin kiraa fuulduraa ni haqama.', ti: 'ነዚ ውዕሊ ክራይ ነቋርጾ? ክፍሊታት ክራይ መጻኢ ክስረዙ እዮም።', so: 'Ma joojinaysaa heshiiskan kirada? Kharashka kirada mustaqbalka waa laga dhaafi doonaa.', ar: 'هل تريد إنهاء عقد الإيجار؟ ستُعفى رسوم الإيجار المستقبلية.', sw: 'Unataka kusitisha upangaji huu? Ada za kodi za baadaye zitaondolewa.',
  },
  'Enter the deposit payment reference.': {
    am: 'የተቀማጭ ክፍያ ማጣቀሻ ያስገቡ።', om: 'Wabii kaffaltii wabii galchaa.', ti: 'መወከሲ ክፍሊት ተቐማጢ ኣእትዉ።', so: 'Geli tixraaca lacagta deebaajiga.', ar: 'أدخل مرجع دفع الوديعة.', sw: 'Weka rejeleo la malipo ya amana.',
  },
  'Enter the deposit return amount in ETB.': {
    am: 'የሚመለሰውን የተቀማጭ መጠን በETB ያስገቡ።', om: 'Hamma wabii deebiʼu ETB tiin galchaa.', ti: 'መጠን ተቐማጢ ዝምለስ ብETB ኣእትዉ።', so: 'Geli qadarka deebaajiga la celinayo oo ETB ah.', ar: 'أدخل مبلغ الوديعة المستردة بعملة ETB.', sw: 'Weka kiasi cha amana kinachorejeshwa kwa ETB.',
  },
  'Enter a reason for the deposit return.': {
    am: 'ለተቀማጩ መመለስ ምክንያት ያስገቡ።', om: 'Sababa wabii deebisuu galchaa.', ti: 'ምኽንያት ምምላስ ተቐማጢ ኣእትዉ።', so: 'Geli sababta deebaajiga loo celinayo.', ar: 'أدخل سبب رد الوديعة.', sw: 'Weka sababu ya kurejesha amana.',
  },
  'Enter the payout reference.': {
    am: 'የክፍያ ማጣቀሻ ያስገቡ።', om: 'Wabii kaffaltii galchaa.', ti: 'መወከሲ ክፍሊት ኣእትዉ።', so: 'Geli tixraaca bixinta.', ar: 'أدخل مرجع الصرف.', sw: 'Weka rejeleo la malipo.',
  },
  'Enter the rent payment reference.': {
    am: 'የኪራይ ክፍያ ማጣቀሻ ያስገቡ።', om: 'Wabii kaffaltii kiraa galchaa.', ti: 'መወከሲ ክፍሊት ክራይ ኣእትዉ።', so: 'Geli tixraaca lacagta kirada.', ar: 'أدخل مرجع دفع الإيجار.', sw: 'Weka rejeleo la malipo ya kodi.',
  },
  'Charges and receipts': {
    am: 'ክፍያዎችና ደረሰኞች', om: 'Kaffaltii fi nagahee', ti: 'ክፍሊታትን ደረሰኛታትን', so: 'Kharashyada iyo rasiidhada', ar: 'الرسوم والإيصالات', sw: 'Ada na risiti',
  },
  'Marketplace listing photo': {
    am: 'የገበያ ዝርዝር ፎቶ', om: 'Suuraa tarree gabaa', ti: 'ስእሊ ዝርዝር ዕዳጋ', so: 'Sawirka liiska suuqa', ar: 'صورة قائمة السوق', sw: 'Picha ya tangazo la soko',
  },
  'Explain what the seller needs to change (at least 10 characters).': {
    am: 'ሻጩ ምን መቀየር እንዳለበት ያብራሩ (ቢያንስ 10 ቁምፊዎች)።', om: 'Wanti gurguraan jijjiiruu qabu ibsaa (qubee yoo xiqqaate 10).', ti: 'እቲ ሻየጣይ እንታይ ክቕይር ከም ዘለዎ ግለጹ (እንተወሓደ 10 ፊደላት)።', so: 'Sharax waxa iibiyuhu u baahan yahay inuu beddelo (ugu yaraan 10 xaraf).', ar: 'اشرح ما يحتاج البائع إلى تغييره (10 أحرف على الأقل).', sw: 'Eleza kile ambacho muuzaji anapaswa kubadilisha (angalau herufi 10).',
  },
  'Explain what needs to change in this property listing (at least 10 characters).': {
    am: 'በዚህ የንብረት ዝርዝር ምን መቀየር እንዳለበት ያብራሩ (ቢያንስ 10 ቁምፊዎች)።', om: 'Tarree qabeenyaa kana keessatti wanti jijjiiramuu qabu ibsaa (qubee yoo xiqqaate 10).', ti: 'ኣብዚ ዝርዝር ንብረት እንታይ ክቕየር ከም ዘለዎ ግለጹ (እንተወሓደ 10 ፊደላት)።', so: 'Sharax waxa ku jira liiska hantidan ee u baahan in la beddelo (ugu yaraan 10 xaraf).', ar: 'اشرح ما الذي يجب تغييره في قائمة العقار هذه (10 أحرف على الأقل).', sw: 'Eleza kinachohitaji kubadilishwa katika tangazo hili la mali (angalau herufi 10).',
  },
  'Enter the person or vendor assigned to this request.': {
    am: 'ለዚህ ጥያቄ የተመደበውን ሰው ወይም አቅራቢ ያስገቡ።', om: 'Nama yookaan dhiyeessaa gaaffii kanaaf ramadame galchaa.', ti: 'ንዚ ሕቶ ዝተመደበ ሰብ ወይ ኣቕራቢ ኣእትዉ።', so: 'Geli qofka ama alaab-qeybiyaha loo qoondeeyey codsigan.', ar: 'أدخل الشخص أو المورّد المعيّن لهذا الطلب.', sw: 'Weka mtu au muuzaji aliyekabidhiwa ombi hili.',
  },
  'Describe the completed work (at least 5 characters).': {
    am: 'የተጠናቀቀውን ሥራ ይግለጹ (ቢያንስ 5 ቁምፊዎች)።', om: 'Hojii xumurame ibsaa (qubee yoo xiqqaate 5).', ti: 'ስራሕ ዝተዛዘመ ግለጹ (እንተወሓደ 5 ፊደላት)።', so: 'Sharax shaqada la dhammeeyey (ugu yaraan 5 xaraf).', ar: 'صف العمل المنجز (5 أحرف على الأقل).', sw: 'Eleza kazi iliyokamilika (angalau herufi 5).',
  },
  'Optional cost estimate in ETB. Leave blank if unknown.': {
    am: 'አማራጭ የወጪ ግምት በETB። ካላወቁት ባዶ ይተዉት።', om: 'Tilmaama baasii filannoo ETB tiin. Yoo hin beekne duwwaa dhiisaa.', ti: 'ግምት ወጻኢ ብETB ኣማራጺ እዩ። እንተዘይፈለጥኩም ባዶ ግደፍዎ።', so: 'Qiyaasta kharashka ee ETB waa ikhtiyaari. Madhan ka tag haddii aan la garanayn.', ar: 'تقدير التكلفة بعملة ETB اختياري. اتركه فارغًا إن لم تعرفه.', sw: 'Makadirio ya gharama kwa ETB ni hiari. Acha wazi ikiwa hujui.',
  },
  'Confirm you reviewed the engagement terms. Enter a reason (at least 10 characters).': {
    am: 'የሥራ ተሳትፎ ውሎችን መገምገምዎን ያረጋግጡ። ምክንያት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Haalota bobbaʼinsa hojii gamaaggamuu keessan mirkaneessaa. Sababa galchaa (qubee yoo xiqqaate 10).',
    ti: 'ውዕላት ተሳትፎ ስራሕ ምግምጋምኩም ኣረጋግጹ። ምኽንያት ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Xaqiiji inaad dib u eegtay shuruudaha hawlgelinta. Geli sabab (ugu yaraan 10 xaraf).',
    ar: 'أكد مراجعتك لشروط الارتباط بالعمل. أدخل السبب (10 أحرف على الأقل).',
    sw: 'Thibitisha kuwa umekagua masharti ya ushiriki wa kazi. Weka sababu (angalau herufi 10).',
  },
  'Explain what needs to be corrected in this document (at least 10 characters).': {
    am: 'በዚህ ሰነድ ምን መታረም እንዳለበት ያብራሩ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sanada kana keessatti wanti sirreeffamuu qabu ibsaa (qubee yoo xiqqaate 10).', ti: 'ኣብዚ ሰነድ እንታይ ክእረም ከም ዘለዎ ግለጹ (እንተወሓደ 10 ፊደላት)።', so: 'Sharax waxa dukumentigan laga saxayo (ugu yaraan 10 xaraf).', ar: 'اشرح ما الذي يجب تصحيحه في هذا المستند (10 أحرف على الأقل).', sw: 'Eleza kinachohitaji kusahihishwa katika hati hii (angalau herufi 10).',
  },
  'Enter the information response or closure reason (at least 10 characters).': {
    am: 'የመረጃ ምላሹን ወይም የመዝጊያ ምክንያቱን ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Deebii odeeffannoo yookaan sababa cufiinsaa galchaa (qubee yoo xiqqaate 10).',
    ti: 'መልሲ ሓበሬታ ወይ ምኽንያት ምዕጻው ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Geli jawaabta macluumaadka ama sababta xidhitaanka (ugu yaraan 10 xaraf).',
    ar: 'أدخل رد المعلومات أو سبب الإغلاق (10 أحرف على الأقل).',
    sw: 'Weka jibu la maelezo au sababu ya kufunga (angalau herufi 10).',
  },
  'Withdraw permission for Agent follow-up? The Agent will immediately lose access to this referral.': {
    am: 'ወኪሉ እንዲከታተል የተሰጠውን ፈቃድ ይነሱ? ወኪሉ ወዲያውኑ የዚህን ሪፈራል መዳረሻ ያጣል።',
    om: 'Hayyama hordoffii bakka buʼaa ni haqtuu? Bakka buʼaan battalumatti seensa ergaa kana ni dhaba.',
    ti: 'ፍቓድ ምክትታል ወኪል ክትስሕቡ? ወኪል ብኡንብኡ መእተዊ ናይዚ ምምራሕ ይስእን።',
    so: 'Ma la noqonaysaa oggolaanshaha dabagalka wakiilka? Wakiilku isla markiiba wuxuu waayi doonaa gelitaanka gudbintan.',
    ar: 'هل تريد سحب الإذن بمتابعة الوكيل؟ سيفقد الوكيل فورًا إمكانية الوصول إلى هذه الإحالة.',
    sw: 'Unaondoa ruhusa ya ufuatiliaji wa wakala? Wakala atapoteza ufikiaji wa rufaa hii mara moja.',
  },
  'Run a fully synthetic training lifecycle? No real insurer, customer, policy, claim, or payment will be contacted or created.': {
    am: 'ሙሉ በሙሉ ሰው ሠራሽ የሥልጠና ዑደት ያስኬዱ? እውነተኛ ኢንሹራንስ ድርጅት፣ ደንበኛ፣ ፖሊሲ፣ የካሳ ጥያቄ ወይም ክፍያ አይገናኝም ወይም አይፈጠርም።',
    om: 'Marsaa leenjii guutummaatti nam-tolchee haa raawwannu? Dhaabbata inshuraansii, maamila, poolisii, gaafii beenyaa yookaan kaffaltii dhugaa hin qunnamnu yookaan hin uumamu.',
    ti: 'ምሉእ ብምሉእ ሰብ ሰራሕ ዑደት ስልጠና ነካይድ? ናይ ሓቂ ኢንሹራንስ፣ ዓሚል፣ ፖሊሲ፣ ክሲ ወይ ክፍሊት ኣይምርካብን ወይ ኣይፍጠርን።',
    so: 'Ma socodsiinaysaa tababar tijaabo oo gebi ahaan macmal ah? Lama xiriiri doono mana la abuuri doono caymis, macmiil, siyaasad, sheegasho ama lacag-bixin dhab ah.',
    ar: 'هل تريد تشغيل دورة تدريبية اصطناعية بالكامل؟ لن يتم التواصل مع شركة تأمين أو عميل أو وثيقة أو مطالبة أو دفعة حقيقية أو إنشاؤها.',
    sw: 'Uendeshe mzunguko wa mafunzo wa kubuni kabisa? Hakuna kampuni ya bima, mteja, sera, dai au malipo halisi yatakayowasiliana nayo au kuundwa.',
  },
  'Synthetic product comparison': {
    am: 'የሰው ሠራሽ ምርት ንጽጽር', om: 'Walbira qabuu oomisha nam-tolchee', ti: 'ምንጽጻር ሰብ ሰራሕ ፍርያት', so: 'Isbarbardhigga badeeco macmal ah', ar: 'مقارنة المنتجات الاصطناعية', sw: 'Ulinganisho wa bidhaa ghushi',
  },
  'Record why this account is approved for activation (at least 10 characters).': {
    am: 'ይህ መለያ ለመንቃት ለምን እንደጸደቀ ይመዝግቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Herregni kun hojii irra ooluuf maaliif akka raggaʼe galmeessaa (qubee yoo xiqqaate 10).',
    ti: 'እዚ ሕሳብ ንምንቃሕ ስለምንታይ ከም ዝጸደቐ መዝግቡ (እንተወሓደ 10 ፊደላት)።',
    so: 'Diiwaangeli sababta akoonkan loogu ansixiyey hawlgelinta (ugu yaraan 10 xaraf).',
    ar: 'سجّل سبب الموافقة على تفعيل هذا الحساب (10 أحرف على الأقل).',
    sw: 'Rekodi sababu ya kuidhinisha akaunti hii iamilishwe (angalau herufi 10).',
  },
  'Search could not be completed. Check your connection and try again.': {
    am: 'ፍለጋውን ማጠናቀቅ አልተቻለም። ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።',
    om: 'Barbaaduun xumuramuu hin dandeenye. Walqunnamtii keessan mirkaneessaa, irra deebiʼaatii yaalaa.',
    ti: 'ምድላይ ምዝዛም ኣይተኻእለን። ርክብኩም ኣረጋግጹን ደጊምኩም ፈትኑን።',
    so: 'Raadinta lama dhammaystiri karin. Hubi isku-xirkaaga oo mar kale isku day.',
    ar: 'تعذر إكمال البحث. تحقق من اتصالك وحاول مرة أخرى.',
    sw: 'Imeshindwa kukamilisha utafutaji. Angalia muunganisho wako na ujaribu tena.',
  },
  'Case update saved.': {
    am: 'የጉዳዩ ማሻሻያ ተቀምጧል።', om: 'Jijjiiramni dhimmaa olkaaʼameera.', ti: 'ምሕዳስ ጉዳይ ተዓቂቡ።', so: 'Cusboonaysiinta kiiska waa la kaydiyey.', ar: 'تم حفظ تحديث الحالة.', sw: 'Sasisho la kesi limehifadhiwa.',
  },
  'No public Edir registration applications have been received.': {
    am: 'ምንም የእድር ይፋዊ ምዝገባ ማመልከቻ አልደረሰም።', om: 'Iyyanni galmee Edir ummataa hin geenye.', ti: 'ዝኾነ ህዝባዊ መመልከቲ ምዝገባ Edir ኣይበጽሐን።', so: 'Lama helin codsiyo diiwaangelin Edir oo dadweyne.', ar: 'لم تُستلم أي طلبات تسجيل عامة لإدير.', sw: 'Hakuna maombi ya umma ya usajili wa Edir yaliyopokelewa.',
  },
  'No affiliated independent Edirs are registered yet.': {
    am: 'እስካሁን የተቆራኙ ገለልተኛ እድሮች አልተመዘገቡም።', om: 'Edirwwan bilisa walitti hidhatan ammaaf hin galmoofne.', ti: 'ክሳብ ሕጂ ዝተተሓሓዙ Edir bilisa ኣይተመዝገቡን።', so: 'Weli lama diiwaangelin Edirro madax-bannaan oo xiriir la leh.', ar: 'لم تُسجّل بعد أي إديرات مستقلة تابعة.', sw: 'Bado hakuna Edir huru zinazohusishwa zilizosajiliwa.',
  },
  'Consolidated operating totals (no member-level details)': {
    am: 'የተጠቃለሉ የሥራ ድምሮች (የአባላት ዝርዝር የለም)', om: 'Idaʼama hojii waliigalaa (balʼina miseensaa malee)', ti: 'ጠቕላላ ድምር ስራሕ (ዝርዝር ኣባላት የለን)', so: 'Wadarta hawlgalka (faahfaahinta xubnaha kuma jirto)', ar: 'إجماليات التشغيل الموحّدة (دون تفاصيل الأعضاء)', sw: 'Jumla za shughuli zilizounganishwa (bila maelezo ya wanachama)',
  },
  'No independent Edir totals are available yet.': {
    am: 'እስካሁን የገለልተኛ እድር ድምሮች አይገኙም።', om: 'Idaʼamni Edir bilisa ammaaf hin jiru.', ti: 'ጠቕላላ ድምር Edir bilisa ክሳብ ሕጂ ኣይርከብን።', so: 'Weli lama hayo wadarta Edir madax-bannaan.', ar: 'لا تتوفر إجماليات الإديرات المستقلة بعد.', sw: 'Jumla za Edir huru bado hazipatikani.',
  },
  'Umbrella Master Edir staff': {
    am: 'የዋናው እድር ሠራተኞች', om: 'Hojjettoota Edir guddaa', ti: 'ሰራሕተኛታት ዋና Edir', so: 'Shaqaalaha Edir-ka dalladda', ar: 'موظفو إدير المظلة', sw: 'Wafanyakazi wa Edir mwavuli',
  },
  'Insurance administration is independently assigned. Each insurance organization has its own account and journal books; this view reports only aggregate counts and totals.': {
    am: 'የኢንሹራንስ አስተዳደር ለየት ብሎ ይመደባል። እያንዳንዱ የኢንሹራንስ ድርጅት የራሱ ሂሳብና የመዝገብ መጻሕፍት አሉት፤ ይህ እይታ ጠቅላላ ቁጥሮችና ድምሮችን ብቻ ያሳያል።',
    om: 'Bulchiinsi inshuraansii of dandaʼee ramadama. Dhaabbanni inshuraansii tokkoon tokkoo herregaa fi galmee mataa isaa qaba; ilaalchi kun lakkoofsaa fi idaʼama waliigalaa qofa gabaasa.',
    ti: 'ምምሕዳር ውሕስነት ብፍሉይ ይምደብ። ነፍሲ ወከፍ ትካል ውሕስነት ናይ ገዛእ ርእሱ ሕሳብን መዝገባት ሒሳብን ኣለዎ፤ እዚ ርእይቶ ጠቕላላ ቁጽርን ድምርን ጥራይ የርኢ።',
    so: 'Maamulka caymiska si madax-bannaan ayaa loo meeleeyaa. Urur kasta oo caymis ahi wuxuu leeyahay akoon iyo buugaag diiwaan oo u gaar ah; muuqaalkani wuxuu soo bandhigayaa tirooyinka iyo wadarta guud oo keliya.',
    ar: 'يُعيّن مسؤول التأمين بشكل مستقل. لكل مؤسسة تأمين حساب ودفاتر قيود خاصة؛ ولا يعرض هذا القسم سوى الأعداد والإجماليات.',
    sw: 'Usimamizi wa bima hugawiwa kwa uhuru. Kila shirika la bima lina akaunti na vitabu vyake; mwonekano huu huripoti hesabu na jumla pekee.',
  },
  'An EthioLife platform administrator must assign a separate Insurance Master Edir administrator before these books can be configured or aggregated.': {
    am: 'እነዚህ መዝገቦች ከመዋቀራቸው ወይም ከመጠቃለላቸው በፊት የEthioLife መድረክ አስተዳዳሪ የተለየ የኢንሹራንስ ዋና እድር አስተዳዳሪ መመደብ አለበት።',
    om: 'Galmeewwan kana qindeessuu yookaan idaʼuu dura bulchaan waltajjii EthioLife bulchaa Edir Inshuraansii adda taʼe ramaduu qaba.',
    ti: 'እዞም መዝገባት ቅድሚ ምቕናዖም ወይ ምጥቕላሎም፣ ምምሕዳር መድረኽ EthioLife ፍሉይ ምምሕዳር Insurance Master Edir ከመድብ ኣለዎ።',
    so: 'Maamulaha madasha EthioLife waa inuu magacaabaa maamule gooni ah oo Insurance Master Edir ka hor inta aan buugaagtan la dejin ama la isku geyn.',
    ar: 'يجب أن يعيّن مسؤول منصة EthioLife مسؤولًا مستقلًا لـInsurance Master Edir قبل إعداد هذه الدفاتر أو تجميعها.',
    sw: 'Msimamizi wa jukwaa la EthioLife lazima amkabidhi msimamizi tofauti wa Insurance Master Edir kabla vitabu hivi havijasanidiwa au kujumlishwa.',
  },
  'No Insurance ledger totals are available yet. An independently authorized Insurance Master Edir operator must connect and manage these books.': {
    am: 'እስካሁን የኢንሹራንስ ደብተር ድምሮች አይገኙም። በገለልተኛ ሁኔታ ፈቃድ የተሰጠው የኢንሹራንስ ዋና እድር ኦፕሬተር እነዚህን መዝገቦች ማገናኘትና ማስተዳደር አለበት።',
    om: 'Idaʼamni galmee inshuraansii ammaaf hin jiru. Ogeessi Edir Inshuraansii hayyama of dandaʼe qabu galmeewwan kana walqabsiisee bulchuu qaba.',
    ti: 'ጠቕላላ መዝገብ ውሕስነት ክሳብ ሕጂ የለን። ብናጻ ፍቓድ ዝተዋህቦ ኦፐሬተር Insurance Master Edir ነዞም መዝገባት ከራኽብን ከመሓድርን ኣለዎ።',
    so: 'Weli lama hayo wadarta buugga caymiska. Hawl-wadeen Insurance Master Edir oo si madax-bannaan loo oggolaaday waa inuu isku xiraa oo maamulaa buugaagtan.',
    ar: 'لا تتوفر إجماليات دفتر التأمين بعد. يجب على مشغّل مستقل مخوّل لـInsurance Master Edir ربط هذه الدفاتر وإدارتها.',
    sw: 'Jumla za daftari la bima bado hazipatikani. Mwendeshaji wa Insurance Master Edir aliyeidhinishwa kwa kujitegemea lazima aunganishe na kusimamia vitabu hivi.',
  },
  'Assign approved member': {
    am: 'የጸደቀ አባል ይመድቡ', om: 'Miseensa raggaʼe ramadaa', ti: 'ኣባል ዝጸደቐ ምድቡ', so: 'Qoondee xubin la ansixiyey', ar: 'عيّن عضوًا معتمدًا', sw: 'Mkabidhi mwanachama aliyeidhinishwa',
  },
  'Recent Edir audit activity': {
    am: 'የቅርብ ጊዜ የእድር ኦዲት እንቅስቃሴ', om: 'Sochii odiitii Edir dhiheenyaa', ti: 'ንጥፈት ኦዲት Edir ናይ ቀረባ ግዜ', so: 'Dhaqdhaqaaqa hanti-dhawrka Edir ee dhowaan', ar: 'أنشطة تدقيق إدير الأخيرة', sw: 'Shughuli za ukaguzi wa Edir za hivi karibuni',
  },
  'No Edir administrative actions are recorded.': {
    am: 'ምንም የእድር አስተዳደራዊ ድርጊቶች አልተመዘገቡም።', om: 'Gochoonni bulchiinsa Edir hin galmoofne.', ti: 'ዝኾነ ተግባር ምምሕዳር Edir ኣይተመዝገበን።', so: 'Wax tallaabo maamul Edir ah lama diiwaangelin.', ar: 'لم تُسجّل أي إجراءات إدارية لإدير.', sw: 'Hakuna hatua za usimamizi wa Edir zilizorekodiwa.',
  },
  'Edir staff assignments': {
    am: 'የእድር ሠራተኛ ምደባዎች', om: 'Ramaddii hojjettoota Edir', ti: 'ምደባታት ሰራሕተኛ Edir', so: 'Meelaynta shaqaalaha Edir', ar: 'تعيينات موظفي إدير', sw: 'Ugawaji wa wafanyakazi wa Edir',
  },
  'Establish separate Insurance Master Edir access': {
    am: 'የተለየ የኢንሹራንስ ዋና እድር መዳረሻ ያዘጋጁ', om: 'Seensa Edir Inshuraansii adda qopheessaa', ti: 'መእተዊ Insurance Master Edir ፍሉይ ኣቑሙ', so: 'Samee gelitaan gaar ah oo Insurance Master Edir ah', ar: 'أنشئ وصولًا مستقلًا لـInsurance Master Edir', sw: 'Weka ufikiaji tofauti wa Insurance Master Edir',
  },
  'Edir savings, shares, and contributions': {
    am: 'የእድር ቁጠባ፣ አክሲዮኖችና መዋጮዎች', om: 'Qusannoo, qooda fi gumaacha Edir', ti: 'ዕቋር፣ ኣክስዮንን ኣበርክቶን Edir', so: 'Kaydka, saamiyada iyo tabarucaadka Edir', ar: 'مدخرات إدير وأسهمه ومساهماته', sw: 'Akiba, hisa na michango ya Edir',
  },
  'Financial products': {
    am: 'የፋይናንስ ምርቶች', om: 'Oomishaalee faayinaansii', ti: 'ፋይናንሳዊ ፍርያት', so: 'Badeecooyinka maaliyadeed', ar: 'المنتجات المالية', sw: 'Bidhaa za kifedha',
  },
  'Open a financial account': {
    am: 'የፋይናንስ ሂሳብ ይክፈቱ', om: 'Herrega faayinaansii banuu', ti: 'ሕሳብ ፋይናንስ ክፈቱ', so: 'Fur akoon maaliyadeed', ar: 'افتح حسابًا ماليًا', sw: 'Fungua akaunti ya kifedha',
  },
  'Product': {
    am: 'ምርት', om: 'Oomisha', ti: 'ፍርያት', so: 'Badeecad', ar: 'المنتج', sw: 'Bidhaa',
  },
  'Your financial accounts': {
    am: 'የፋይናንስ ሂሳቦችዎ', om: 'Herrega faayinaansii keessan', ti: 'ሕሳባት ፋይናንስኩም', so: 'Akoonnadaada maaliyadeed', ar: 'حساباتك المالية', sw: 'Akaunti zako za kifedha',
  },
  'Record a deposit or contribution received': {
    am: 'የተቀበሉትን ተቀማጭ ወይም መዋጮ ይመዝግቡ', om: 'Kuusaa yookaan gumaacha fudhatame galmeessaa', ti: 'ተቐማጢ ወይ ኣበርክቶ ዝተቐበልኩም መዝግቡ', so: 'Diiwaangeli deebaaji ama tabarucaad la helay', ar: 'سجّل الإيداع أو المساهمة المستلمة', sw: 'Rekodi amana au mchango uliopokelewa',
  },
  'Member account': {
    am: 'የአባል ሂሳብ', om: 'Herrega miseensaa', ti: 'ሕሳብ ኣባል', so: 'Akoonka xubinta', ar: 'حساب العضو', sw: 'Akaunti ya mwanachama',
  },
  'Financial transaction review': {
    am: 'የፋይናንስ ግብይት ግምገማ', om: 'Gamaaggama daldala faayinaansii', ti: 'ግምገማ ግብይት ፋይናንስ', so: 'Dib-u-eegista macaamilka maaliyadeed', ar: 'مراجعة المعاملات المالية', sw: 'Ukaguzi wa miamala ya kifedha',
  },
  'No Edir financial transactions are recorded.': {
    am: 'ምንም የእድር የፋይናንስ ግብይት አልተመዘገበም።', om: 'Daldalli faayinaansii Edir hin galmoofne.', ti: 'ዝኾነ ግብይት ፋይናንስ Edir ኣይተመዝገበን።', so: 'Wax macaamil maaliyadeed Edir ah lama diiwaangelin.', ar: 'لم تُسجّل معاملات مالية لإدير.', sw: 'Hakuna miamala ya kifedha ya Edir iliyorekodiwa.',
  },
  'Propose a platform-wide daily cap': {
    am: 'በመድረኩ ሁሉ የሚሠራ ዕለታዊ ገደብ ያቅርቡ', om: 'Daangaa guyyaa waltajjii guutuu dhiyeessaa', ti: 'ዕለታዊ ደረት ምሉእ መድረኽ ኣቕርቡ', so: 'Soo jeedi xad maalinle ah oo madasha oo dhan ah', ar: 'اقترح حدًا يوميًا على مستوى المنصة', sw: 'Pendekeza kikomo cha kila siku cha jukwaa lote',
  },
  'Document type': {
    am: 'የሰነድ ዓይነት', om: 'Gosa sanadaa', ti: 'ዓይነት ሰነድ', so: 'Nooca dukumentiga', ar: 'نوع المستند', sw: 'Aina ya hati',
  },
  'Upload PDF/JPEG/PNG (max 10 MB)': {
    am: 'PDF/JPEG/PNG ይጫኑ (ከፍተኛው 10 MB)', om: 'PDF/JPEG/PNG olkaaʼaa (hanga 10 MB)', ti: 'PDF/JPEG/PNG ጽዓኑ (ክሳብ 10 MB)', so: 'Soo geli PDF/JPEG/PNG (ugu badnaan 10 MB)', ar: 'ارفع PDF/JPEG/PNG (بحد أقصى 10 ميغابايت)', sw: 'Pakia PDF/JPEG/PNG (kiwango cha juu MB 10)',
  },
  'Savings account to receive proceeds': {
    am: 'ገንዘቡ የሚገባበት የቁጠባ ሂሳብ', om: 'Herrega qusannoo maallaqni itti seenu', ti: 'ሕሳብ ዕቋር ገንዘብ ዝኣትዎ', so: 'Akoonka kaydka ee lacagta lagu shubayo', ar: 'حساب الادخار الذي سيستلم المبلغ', sw: 'Akaunti ya akiba itakayopokea fedha',
  },
  'Member KYC review queue': {
    am: 'የአባላት KYC ግምገማ ወረፋ', om: 'Tarree gamaaggama KYC miseensotaa', ti: 'ረድፊ ግምገማ KYC ኣባላት', so: 'Safka dib-u-eegista KYC ee xubnaha', ar: 'قائمة مراجعة KYC للأعضاء', sw: 'Foleni ya ukaguzi wa KYC ya wanachama',
  },
  'No active memberships are awaiting KYC review.': {
    am: 'ምንም ንቁ አባልነት የKYC ግምገማን አይጠብቅም።', om: 'Miseensummaan hojii irra jiru gamaaggama KYC hin eeggatu.', ti: 'ዝኾነ ንጡፍ ኣባልነት ግምገማ KYC ኣይጽበን።', so: 'Ma jiraan xubno firfircoon oo sugaya dib-u-eegista KYC.', ar: 'لا توجد عضويات نشطة تنتظر مراجعة KYC.', sw: 'Hakuna uanachama hai unaosubiri ukaguzi wa KYC.',
  },
  'Loan document review queue': {
    am: 'የብድር ሰነድ ግምገማ ወረፋ', om: 'Tarree gamaaggama sanada liqaa', ti: 'ረድፊ ግምገማ ሰነድ ልቓሕ', so: 'Safka dib-u-eegista dukumentiyada amaahda', ar: 'قائمة مراجعة مستندات القروض', sw: 'Foleni ya ukaguzi wa hati za mikopo',
  },
  'No loan documents are awaiting review.': {
    am: 'ምንም የብድር ሰነድ ግምገማን አይጠብቅም።', om: 'Sanadni liqaa gamaaggama hin eeggatu.', ti: 'ዝኾነ ሰነድ ልቓሕ ግምገማ ኣይጽበን።', so: 'Ma jiraan dukumentiyo amaah oo sugaya dib-u-eegis.', ar: 'لا توجد مستندات قروض تنتظر المراجعة.', sw: 'Hakuna hati za mkopo zinazosubiri ukaguzi.',
  },
  'Edir credit applications': {
    am: 'የእድር ብድር ማመልከቻዎች', om: 'Iyyata liqaa Edir', ti: 'መመልከቲ ልቓሕ Edir', so: 'Codsiyada amaahda Edir', ar: 'طلبات ائتمان إدير', sw: 'Maombi ya mikopo ya Edir',
  },
  'No Edir credit applications are awaiting review.': {
    am: 'ምንም የእድር ብድር ማመልከቻ ግምገማን አይጠብቅም።', om: 'Iyyanni liqaa Edir gamaaggama hin eeggatu.', ti: 'ዝኾነ መመልከቲ ልቓሕ Edir ግምገማ ኣይጽበን።', so: 'Ma jiraan codsiyo amaah Edir ah oo sugaya dib-u-eegis.', ar: 'لا توجد طلبات ائتمان لإدير تنتظر المراجعة.', sw: 'Hakuna maombi ya mkopo ya Edir yanayosubiri ukaguzi.',
  },
  'Your Edir loans and principal schedule': {
    am: 'የእድር ብድሮችዎና የዋና ገንዘብ መርሃ ግብር', om: 'Liqiiwwan Edir keessan fi sagantaa maallaqa buʼuuraa', ti: 'ልቓሓት Edirኩምን መርሃ ግብር ዋና ገንዘብን', so: 'Amaahyadaada Edir iyo jadwalka raasamaalka', ar: 'قروض إدير الخاصة بك وجدول أصل المبلغ', sw: 'Mikopo yako ya Edir na ratiba ya mtaji',
  },
  'No accepted Edir loans.': {
    am: 'የተቀበሉት የእድር ብድሮች የሉም።', om: 'Liqiin Edir fudhatame hin jiru.', ti: 'ዝተቐበልኩሞ ልቓሕ Edir የለን።', so: 'Ma jiraan amaah Edir oo la aqbalay.', ar: 'لا توجد قروض إدير مقبولة.', sw: 'Hakuna mikopo ya Edir iliyokubaliwa.',
  },
  'Member support and complaints': {
    am: 'የአባል ድጋፍና ቅሬታዎች', om: 'Deeggarsa miseensaa fi komii', ti: 'ደገፍ ኣባልን ጥርዓንን', so: 'Taageerada xubnaha iyo cabashooyinka', ar: 'دعم الأعضاء والشكاوى', sw: 'Usaidizi wa wanachama na malalamiko',
  },
  'Submit a private complaint about service, credit decisions, repayments, fees, privacy, or suspected fraud. Edir staff will track the case and provide a resolution.': {
    am: 'ስለ አገልግሎት፣ የብድር ውሳኔዎች፣ ክፍያ መመለስ፣ ክፍያዎች፣ ግላዊነት ወይም የተጠረጠረ ማጭበርበር የግል ቅሬታ ያቅርቡ። የእድር ሠራተኞች ጉዳዩን ይከታተሉና መፍትሔ ይሰጣሉ።',
    om: 'Tajaajila, murtii liqaa, kaffaltii deebisuu, kaffaltiiwwan, dhuunfaa yookaan gowwoomsaa shakkame irratti komii iccitii dhiyeessaa. Hojjettoonni Edir dhimma hordofanii furmaata kennu.',
    ti: 'ብዛዕባ ኣገልግሎት፣ ውሳነታት ልቓሕ፣ ምምላስ ክፍሊት፣ ክፍሊታት፣ ብሕታዊነት ወይ ዝተጠርጠረ ምትላል ምስጢራዊ ጥርዓን ኣቕርቡ። ሰራሕተኛታት Edir ጉዳዩ ተኸታቲሎም ፍታሕ ክህቡ እዮም።',
    so: 'Gudbi cabasho gaar ah oo ku saabsan adeegga, go’aamada amaahda, dib-u-bixinta, khidmadaha, asturnaanta ama khiyaano laga shakiyey. Shaqaalaha Edir ayaa la socon doona kiiska oo xal ka bixin doona.',
    ar: 'قدّم شكوى خاصة بشأن الخدمة أو قرارات الائتمان أو السداد أو الرسوم أو الخصوصية أو الاشتباه في الاحتيال. سيتابع موظفو إدير الحالة ويقدمون حلًا.',
    sw: 'Wasilisha malalamiko ya faragha kuhusu huduma, maamuzi ya mkopo, marejesho, ada, faragha au tuhuma za udanganyifu. Wafanyakazi wa Edir watafuatilia kesi na kutoa suluhisho.',
  },
  'Complaint category': {
    am: 'የቅሬታ ምድብ', om: 'Ramaddii komii', ti: 'ምድብ ጥርዓን', so: 'Qaybta cabashada', ar: 'فئة الشكوى', sw: 'Aina ya malalamiko',
  },
  'Describe the issue': {
    am: 'ችግሩን ይግለጹ', om: 'Rakkoo ibsaa', ti: 'ጉዳይ ግለጹ', so: 'Sharax dhibaatada', ar: 'صف المشكلة', sw: 'Eleza tatizo',
  },
  'You have no submitted complaints.': {
    am: 'ምንም ቅሬታ አላቀረቡም።', om: 'Komii hin dhiyeessine.', ti: 'ዝኾነ ጥርዓን ኣየቕረብኩምን።', so: 'Ma aadan gudbin wax cabasho ah.', ar: 'لم تقدم أي شكاوى.', sw: 'Hujawasilisha malalamiko yoyote.',
  },
  'Member complaint queue': {
    am: 'የአባል ቅሬታ ወረፋ', om: 'Tarree komii miseensaa', ti: 'ረድፊ ጥርዓን ኣባል', so: 'Safka cabashooyinka xubnaha', ar: 'قائمة شكاوى الأعضاء', sw: 'Foleni ya malalamiko ya wanachama',
  },
  'No Edir member complaints are open.': {
    am: 'ምንም ክፍት የእድር አባል ቅሬታ የለም።', om: 'Komii miseensaa Edir banaa hin jiru.', ti: 'ዝኾነ ክፉት ጥርዓን ኣባል Edir የለን።', so: 'Ma jiraan cabashooyin xubnaha Edir ah oo furan.', ar: 'لا توجد شكاوى مفتوحة لأعضاء إدير.', sw: 'Hakuna malalamiko ya wanachama wa Edir yaliyo wazi.',
  },
  'Update complaint status': {
    am: 'የቅሬታውን ሁኔታ ያዘምኑ', om: 'Haala komii haaromsi', ti: 'ኩነታት ጥርዓን ኣሐድሱ', so: 'Cusboonaysii xaaladda cabashada', ar: 'حدّث حالة الشكوى', sw: 'Sasisha hali ya malalamiko',
  },
  'Priority': {
    am: 'ቅድሚያ', om: 'Dursa', ti: 'ቀዳምነት', so: 'Mudnaanta', ar: 'الأولوية', sw: 'Kipaumbele',
  },
  'Resolution summary (required to close)': {
    am: 'የመፍትሔ ማጠቃለያ (ለመዝጋት ያስፈልጋል)', om: 'Cuunfaa furmaataa (cufuuf barbaachisa)', ti: 'ሓፈሻዊ ፍታሕ (ንምዕጻው የድሊ)', so: 'Soo koobidda xallinta (waa in la xiraa)', ar: 'ملخص الحل (مطلوب للإغلاق)', sw: 'Muhtasari wa suluhisho (unahitajika kufunga)',
  },
  'Loan servicing and maker-checker queue': {
    am: 'የብድር አስተዳደርና የአዘጋጅ-አጽዳቂ ወረፋ', om: 'Tajaajila liqaa fi tarree qopheessaa-raggaasisaa', ti: 'ምምሕዳር ልቓሕን ረድፊ ኣዳላው-ኣጽዳቒን', so: 'Maaraynta amaahda iyo safka diyaariye-hubiyaha', ar: 'خدمة القروض وقائمة الإعداد والمراجعة', sw: 'Huduma ya mikopo na foleni ya mtayarishaji-mkaguzi',
  },
  'No Edir loans are available for servicing.': {
    am: 'ለአስተዳደር የሚቀርብ የእድር ብድር የለም።', om: 'Liqiin Edir tajaajilaaf jiru hin jiru.', ti: 'ልቓሕ Edir ንምምሕዳር ዝርከብ የለን።', so: 'Ma jiraan amaah Edir ah oo adeeg loo hayo.', ar: 'لا توجد قروض إدير متاحة للخدمة.', sw: 'Hakuna mikopo ya Edir inayopatikana kwa huduma.',
  },
  'ETHIOLIFE_EDIR · CENTRAL COMMUNITY': {
    am: 'ETHIOLIFE_EDIR · ማዕከላዊ ማኅበረሰብ', om: 'ETHIOLIFE_EDIR · HAWAASA GIDDU-GALEESSAA', ti: 'ETHIOLIFE_EDIR · ማእከላይ ማሕበረሰብ', so: 'ETHIOLIFE_EDIR · BULSHADA DHEXE', ar: 'ETHIOLIFE_EDIR · المجتمع المركزي', sw: 'ETHIOLIFE_EDIR · JAMII KUU',
  },
  'EthioLife Edir': {
    am: 'EthioLife እድር', om: 'Edir EthioLife', ti: 'Edir EthioLife', so: 'Ururka Edir ee EthioLife', ar: 'إدير EthioLife', sw: 'Jumuiya ya Edir ya EthioLife',
  },
  'One central Edir registry for EthioLife members, with member and administration workspaces.': {
    am: 'ለEthioLife አባላት የተዘጋጀ አንድ ማዕከላዊ የእድር መዝገብ፣ የአባላትና የአስተዳደር የሥራ ቦታዎች ያሉት።',
    om: 'Galmee Edir giddugaleessaa tokko miseensota EthioLife tiif, iddoowwan hojii miseensotaa fi bulchiinsaa wajjin.',
    ti: 'ንኣባላት EthioLife ሓደ ማእከላይ መዝገብ Edir፣ ቦታታት ስራሕ ኣባላትን ምምሕዳርን ዘለዎ።',
    so: 'Hal diiwaan Edir dhexe oo loogu talagalay xubnaha EthioLife, leh goobo shaqo oo xubnaha iyo maamulka ah.',
    ar: 'سجل إدير مركزي واحد لأعضاء EthioLife، مع مساحات عمل للأعضاء والإدارة.',
    sw: 'Sajili moja kuu ya Edir kwa wanachama wa EthioLife, yenye maeneo ya kazi ya wanachama na usimamizi.',
  },
  'Staged financial pilot: approved savings, share, and contribution products; member accounts; double-entry postings; and independent transaction approval. Lending, insurance, and benefit payouts require their own approved policies and controls.': {
    am: 'በደረጃ የሚተገበር የፋይናንስ ሙከራ፦ የጸደቁ የቁጠባ፣ የአክሲዮንና የመዋጮ ምርቶች፤ የአባል ሂሳቦች፤ ድርብ-ግቤት መዝገብ፤ እና ገለልተኛ የግብይት ማጽደቅ። ብድር፣ ኢንሹራንስና የጥቅም ክፍያዎች የራሳቸውን የጸደቁ ፖሊሲዎችና ቁጥጥሮች ይፈልጋሉ።',
    om: 'Pilootii faayinaansii sadarkaa sadarkaan deemuu: oomishaalee qusannoo, qooda fi gumaacha raggaʼan; herrega miseensaa; galmee herregaa galmee lamaan; fi raggaasisa daldalaa of dandaʼe. Liqiin, inshuraansiin fi kaffaltiin faayidaa imaammataa fi toʼannoo mataa isaanii barbaadu.',
    ti: 'ፋይናንሳዊ ፓይሎት ብደረጃ፦ ዝተፈቕዱ ፍርያት ዕቋር፣ ኣክስዮንን ኣበርክቶን፤ ሕሳባት ኣባላት፤ ድርብ መዝገብ ሒሳብ፤ ናጻ ምጽዳቕ ግብይትን። ልቓሕ፣ ውሕስነትን ክፍሊት ጥቕምን ናይ ገዛእ ርእሶም ዝተፈቕዱ ፖሊሲታትን ቁጽጽራትን ይሓትቱ።',
    so: 'Tijaabo maaliyadeed oo heerar leh: kayd, saamiyo iyo tabarucaad la ansixiyey; akoonno xubno; diiwaangelin xisaabeed laba-geesood ah; iyo ansixin macaamil oo madax-bannaan. Amaahda, caymiska iyo bixinta faa’iidooyinku waxay u baahan yihiin siyaasad iyo xakamayn iyaga u gaar ah oo la ansixiyey.',
    ar: 'مرحلة تجريبية مالية على مراحل: منتجات ادخار وأسهم ومساهمات معتمدة؛ حسابات أعضاء؛ قيود محاسبية مزدوجة؛ وموافقة مستقلة على المعاملات. يتطلب الإقراض والتأمين وصرف المزايا سياسات وضوابط معتمدة خاصة بها.',
    sw: 'Jaribio la kifedha la hatua: bidhaa za akiba, hisa na michango zilizoidhinishwa; akaunti za wanachama; maingizo ya hesabu za pande mbili; na idhini huru ya miamala. Mikopo, bima na malipo ya manufaa yanahitaji sera na udhibiti wake ulioidhinishwa.',
  },
  'Organization workspace': {
    am: 'የድርጅት የሥራ ቦታ', om: 'Iddoo hojii dhaabbataa', ti: 'ቦታ ስራሕ ትካል', so: 'Goobta shaqada ururka', ar: 'مساحة عمل المؤسسة', sw: 'Eneo la kazi la shirika',
  },
  'Loading EthioLife Edir…': {
    am: 'EthioLife እድርን በመጫን ላይ…', om: 'Edir EthioLife feʼaa jira…', ti: 'EthioLife Edir ይጽዓን ኣሎ…', so: 'Waxaa la soo rarayaa EthioLife Edir…', ar: 'جارٍ تحميل EthioLife Edir…', sw: 'Inapakia EthioLife Edir…',
  },
  'Edir staff workspace': {
    am: 'የእድር ሠራተኛ የሥራ ቦታ', om: 'Iddoo hojii hojjettoota Edir', ti: 'ቦታ ስራሕ ሰራሕተኛታት Edir', so: 'Goobta shaqada shaqaalaha Edir', ar: 'مساحة عمل موظفي إدير', sw: 'Eneo la kazi la wafanyakazi wa Edir',
  },
  'This role has read-only group and membership visibility within the central Edir service.': {
    am: 'ይህ ሚና በማዕከላዊው የእድር አገልግሎት ውስጥ ቡድኖችንና አባልነትን ማንበብ ብቻ ይችላል።',
    om: 'Gaheen kun tajaajila Edir giddugaleessaa keessatti garee fi miseensummaa dubbisuu qofa argata.',
    ti: 'እዚ ሚና ኣብ ማእከላይ ኣገልግሎት Edir ጉጅለን ኣባልነትን ንምንባብ ጥራይ ዝፈቅድ እዩ።',
    so: 'Doorkani wuxuu adeegga Edir dhexe ka leeyahay aragti akhris-keliya ah oo ku saabsan kooxaha iyo xubinnimada.',
    ar: 'يتيح هذا الدور عرض المجموعات والعضويات للقراءة فقط ضمن خدمة إدير المركزية.',
    sw: 'Jukumu hili huruhusu kutazama vikundi na uanachama pekee katika huduma kuu ya Edir.',
  },
  'Edir service map': {
    am: 'የእድር አገልግሎት ካርታ', om: 'Kaartaa tajaajila Edir', ti: 'ካርታ ኣገልግሎት Edir', so: 'Khariidadda adeegga Edir', ar: 'خريطة خدمات إدير', sw: 'Ramani ya huduma za Edir',
  },
  'Edir mini-apps': {
    am: 'የእድር ሚኒ-መተግበሪያዎች', om: 'Mini-appoota Edir', ti: 'ሚኒ-ኣፕሊኬሽናት Edir', so: 'Barnaamijyada yaryar ee Edir', ar: 'تطبيقات إدير المصغّرة', sw: 'Programu ndogo za Edir',
  },
  'Jump directly to the service area you need.': {
    am: 'ወደሚያስፈልግዎት የአገልግሎት ክፍል በቀጥታ ይሂዱ።', om: 'Kallattiin gara kutaa tajaajilaa isin barbaachisutti ceʼaa.', ti: 'ብቐጥታ ናብቲ ዘድልየኩም ክፍሊ ኣገልግሎት ኪዱ።', so: 'Si toos ah ugu gudub qaybta adeegga aad u baahan tahay.', ar: 'انتقل مباشرةً إلى قسم الخدمة الذي تحتاجه.', sw: 'Nenda moja kwa moja kwenye sehemu ya huduma unayohitaji.',
  },
  'Open service': {
    am: 'አገልግሎቱን ይክፈቱ', om: 'Tajaajila bani', ti: 'ኣገልግሎት ክፈቱ', so: 'Fur adeegga', ar: 'افتح الخدمة', sw: 'Fungua huduma',
  },
  'Enter a document review reason (minimum 10 characters).': {
    am: 'የሰነድ ግምገማ ምክንያት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Sababa gamaaggama sanadaa galchaa (qubee yoo xiqqaate 10).',
    ti: 'ምኽንያት ግምገማ ሰነድ ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Geli sababta dib-u-eegista dukumentiga (ugu yaraan 10 xaraf).',
    ar: 'أدخل سبب مراجعة المستند (10 أحرف على الأقل).',
    sw: 'Weka sababu ya ukaguzi wa hati (angalau herufi 10).',
  },
  'Archive this Edir group? Members will keep their historical assignments.': {
    am: 'ይህን የእድር ቡድን ወደ ማህደር ያስገቡ? አባላት የቀድሞ ምደባዎቻቸውን ይይዛሉ።',
    om: 'Garee Edir kana kuusaa keessatti haa kaaʼuu? Miseensonni ramaddiiwwan seenaa isaanii ni tursu.',
    ti: 'ነዚ ጉጅለ Edir ኣብ ማህደር ንኣእትዎ? ኣባላት ታሪኻዊ ምደባታቶም ክዕቅቡ እዮም።',
    so: 'Ma kaydinaysaa kooxda Edir? Xubnuhu waxay hayn doonaan meelayntoodii hore.',
    ar: 'هل تريد أرشفة مجموعة إدير؟ سيحتفظ الأعضاء بتعييناتهم السابقة.',
    sw: 'Hifadhi kikundi hiki cha Edir? Wanachama wataendelea kuwa na ugawaji wao wa kihistoria.',
  },
  'Deactivate this Edir staff assignment?': {
    am: 'ይህን የእድር ሠራተኛ ምደባ ያቦዝኑ?', om: 'Ramaddii hojjetaa Edir kana dhaabuu?', ti: 'ነዚ ምደባ ሰራሕተኛ Edir ንስናኽሎ?', so: 'Ma joojinaysaa meelayntan shaqaalaha Edir?', ar: 'هل تريد إلغاء تعيين موظف إدير هذا؟', sw: 'Unazima ugawaji huu wa mfanyakazi wa Edir?',
  },
  'Enter a reversal reason (at least 10 characters).': {
    am: 'የመሰረዝ ምክንያት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sababa garagalchuu galchaa (qubee yoo xiqqaate 10).', ti: 'ምኽንያት ምምላስ ኣእትዉ (እንተወሓደ 10 ፊደላት)።', so: 'Geli sababta dib-u-celinta (ugu yaraan 10 xaraf).', ar: 'أدخل سبب العكس (10 أحرف على الأقل).', sw: 'Weka sababu ya kubatilisha (angalau herufi 10).',
  },
  'Enter a decision reason (at least 10 characters).': {
    am: 'የውሳኔ ምክንያት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።', om: 'Sababa murtii galchaa (qubee yoo xiqqaate 10).', ti: 'ምኽንያት ውሳነ ኣእትዉ (እንተወሓደ 10 ፊደላት)።', so: 'Geli sababta go’aanka (ugu yaraan 10 xaraf).', ar: 'أدخل سبب القرار (10 أحرف على الأقل).', sw: 'Weka sababu ya uamuzi (angalau herufi 10).',
  },
  'Entity access assigned.': {
    am: 'የድርጅት መዳረሻ ተመድቧል።', om: 'Seensaan dhaabbataa ramadameera.', ti: 'መእተዊ ትካል ተመዲቡ።', so: 'Gelitaanka hay’adda waa la qoondeeyey.', ar: 'تم تعيين صلاحية الوصول إلى الكيان.', sw: 'Ufikiaji wa shirika umetolewa.',
  },
  'Source entity mapped.': {
    am: 'ምንጭ ድርጅት ተያይዟል።', om: 'Dhaabbanni maddaa walqabsiifameera.', ti: 'ትካል ምንጪ ተተሓሒዙ።', so: 'Hay’adda isha waa la waafajiyey.', ar: 'تم ربط الكيان المصدر.', sw: 'Shirika chanzo limeunganishwa.',
  },
  'Source account mapped.': {
    am: 'ምንጭ ሂሳብ ተያይዟል።', om: 'Herregni maddaa walqabsiifameera.', ti: 'ሕሳብ ምንጪ ተተሓሒዙ።', so: 'Akoonka isha waa la waafajiyey.', ar: 'تم ربط الحساب المصدر.', sw: 'Akaunti chanzo imeunganishwa.',
  },
  'NEXT STEPS': {
    am: 'ቀጣይ እርምጃዎች', om: 'TARKAANFIIWWAN ITTAANAN', ti: 'ዝቕጽሉ ስጉምትታት', so: 'TALLAABOOYINKA XIGA', ar: 'الخطوات التالية', sw: 'HATUA ZINAZOFUATA',
  },
  'Pick up where your role needs you': {
    am: 'ሚናዎ በሚፈልግዎት ቦታ ሥራዎን ይቀጥሉ', om: 'Gaheen keessan bakka isin barbaadu irraa hojii itti fufaa', ti: 'ሚናኹም ኣብ ዘድልየኩም ቦታ ስራሕኩም ቀጽሉ', so: 'Ka sii wad meesha doorkaagu kaaga baahan yahay', ar: 'تابع من حيث يتطلب دورك', sw: 'Endelea pale jukumu lako linapokuhitaji',
  },
  'Figures cover all records returned to this overview for your account and role. No reporting period is selected.': {
    am: 'ቁጥሮቹ ለመለያዎና ለሚናዎ በዚህ አጠቃላይ እይታ የቀረቡትን ሁሉንም መዝገቦች ያካትታሉ። ምንም የሪፖርት ጊዜ አልተመረጠም።',
    om: 'Lakkoofsi kun galmeewwan ilaalcha kana keessatti herrega fi gahee keessaniif deebifaman hunda hammata. Yeroon gabaasaa hin filatamne.',
    ti: 'እቶም ቁጽርታት ንሕሳብኩምን ሚናኹምን ኣብዚ ሓፈሻዊ ርእይቶ ዝተመለሱ ኩሎም መዝገባት የጠቓልሉ። ግዜ ሪፖርት ኣይተመርጸን።',
    so: 'Tirooyinku waxay daboolayaan dhammaan diiwaannada muuqaalka guud ugu soo celiyey akoonkaaga iyo doorkaaga. Muddada warbixinta lama dooran.',
    ar: 'تشمل الأرقام جميع السجلات التي أُعيدت لهذا العرض العام وفقًا لحسابك ودورك. لم تُحدد فترة للتقرير.',
    sw: 'Takwimu zinajumuisha rekodi zote zilizoonyeshwa katika muhtasari huu kwa akaunti na jukumu lako. Kipindi cha taarifa hakijachaguliwa.',
  },
  'Some records are not included because they are outside this role’s permitted view; those omitted records are not counted as zero.': {
    am: 'ከዚህ ሚና የተፈቀደ እይታ ውጭ የሆኑ አንዳንድ መዝገቦች አልተካተቱም፤ የተተዉ መዝገቦች እንደ ዜሮ አልተቆጠሩም።',
    om: 'Galmeewwan tokko tokko daangaa ilaalcha gahee kanaa alatti waan argamaniif hin dabalaman; galmeewwan hafan akka zeeroo hin lakkaaʼaman.',
    ti: 'ገለ መዝገባት ካብ ዝተፈቕደ ርእይቶ እዚ ሚና ወጻኢ ስለዝኾኑ ኣይተኻተቱን፤ እቶም ዝተረፉ መዝገባት ከም ዜሮ ኣይተቖጽሩን።',
    so: 'Diiwaanno qaar laguma darin maadaama ay ka baxsan yihiin aragtida doorkan loo oggol yahay; kuwa laga reebay looma tirin eber.',
    ar: 'لم تُدرج بعض السجلات لأنها خارج نطاق العرض المسموح لهذا الدور؛ ولم تُحتسب السجلات المستبعدة على أنها صفر.',
    sw: 'Baadhi ya rekodi hazijajumuishwa kwa kuwa ziko nje ya mwonekano unaoruhusiwa kwa jukumu hili; rekodi zilizoachwa hazijahesabiwa kama sifuri.',
  },
  'One or more available data sources could not be loaded. Figures from those sources are omitted; refresh to retry.': {
    am: 'አንድ ወይም ከዚያ በላይ የሚገኙ የውሂብ ምንጮችን መጫን አልተቻለም። ከእነዚያ ምንጮች የሚመጡ ቁጥሮች ተወግደዋል፤ እንደገና ለመሞከር ያድሱ።',
    om: 'Maddoonni daataa argaman tokko yookaan isaa ol feʼuun hin dandaʼamne. Lakkoofsi maddoota sanaa hin dabalamu; irra deebiʼuuf haaromsi.',
    ti: 'ሓደ ወይ ልዕሊኡ ዝርከቡ ምንጭታት ዳታ ምጽዓን ኣይተኻእለን። ካብኦም ዝመጹ ቁጽርታት ኣይተኻተቱን፤ ንምድጋም ኣሐድስ።',
    so: 'Lama soo rari karin hal ama in ka badan oo ilo xogeed ah. Tirooyinka ilahaas waa laga reebay; dib u cusboonaysii si aad isugu daydo mar kale.',
    ar: 'تعذر تحميل مصدر بيانات متاح واحد أو أكثر. تم استبعاد الأرقام من تلك المصادر؛ حدّث الصفحة لإعادة المحاولة.',
    sw: 'Chanzo kimoja au zaidi cha data kinachopatikana hakikuweza kupakiwa. Takwimu za vyanzo hivyo zimeachwa; onyesha upya ili kujaribu tena.',
  },
  'LANDLORD SELF-SERVICE': {
    am: 'ለአከራይ ራስ-አገልግሎት', om: 'TAJAJILA OFII ABBAA QABEENYAA', ti: 'ናይ ኣከራዪ ርእሰ-ኣገልግሎት', so: 'ADEEGGA IS-ADEEGGA MULKIILAHA', ar: 'الخدمة الذاتية للمالك', sw: 'HUDUMA YA KUJIHUDUMIA KWA MWENYE NYUMBA',
  },
  'Your property portfolio': {
    am: 'የንብረት ፖርትፎሊዮዎ', om: 'Kuusaa qabeenyaa keessan', ti: 'ፖርትፎሊዮ ንብረትኩም', so: 'Hantida ma-guurtada ah ee aad maamusho', ar: 'محفظة عقاراتك', sw: 'Mali zako za nyumba',
  },
  'Review your listings, occupancy, maintenance requests, and recorded lease receipts. Reconciled receipts are not a payout confirmation.': {
    am: 'ዝርዝር ማስታወቂያዎችዎን፣ የተከራይነት ሁኔታን፣ የጥገና ጥያቄዎችንና የተመዘገቡ የኪራይ ደረሰኞችን ይመልከቱ። የተስማሙ ደረሰኞች ክፍያ መፈጸሙን አያረጋግጡም።',
    om: 'Tarree qabeenyaa, haala qabannaa, gaaffii suphaa fi nagahee kiraa galmaaʼe ilaalaa. Nagaheen wal-simsiifame kaffaltiin baʼeera jechuu miti.',
    ti: 'ዝርዝር ንብረትኩም፣ ኩነታት ነባርነት፣ ሕቶታት ጽገናን ዝተመዝገቡ ደረሰናት ክራይን ገምግሙ። ዝተሰማምዑ ደረሰናት ክፍሊት ከምዝተፈጸመ ኣየረጋግጹን።',
    so: 'Dib u eeg liisaskaaga, deganaanshaha, codsiyada dayactirka iyo rasiidhada kirada ee la diiwaangeliyey. Rasiidh la heshiisiiyey ma xaqiijinayo in lacag laguu diray.',
    ar: 'راجع قوائمك والإشغال وطلبات الصيانة وإيصالات الإيجار المسجلة. تسوية الإيصالات لا تؤكد تحويل دفعة إليك.',
    sw: 'Kagua matangazo yako, ukaaji, maombi ya matengenezo na risiti za kodi zilizorekodiwa. Risiti zilizolinganishwa hazithibitishi kuwa malipo yametumwa.',
  },
  'Some portfolio information is unavailable to this account or could not be loaded. Refresh or check access before relying on these totals.': {
    am: 'አንዳንድ የፖርትፎሊዮ መረጃዎች ለዚህ መለያ አይገኙም ወይም ሊጫኑ አልቻሉም። በእነዚህ ድምሮች ላይ ከመመርኮዝዎ በፊት ያድሱ ወይም መዳረሻዎን ያረጋግጡ።',
    om: 'Odeeffannoon kuusaa tokko tokko herrega kanaaf hin jiru yookaan feʼamuu hin dandeenye. Idaʼama kana irratti hirkachuu dura haaromsi yookaan seensa mirkaneessi.',
    ti: 'ገለ ሓበሬታ ፖርትፎሊዮ ንእዚ ሕሳብ ኣይርከብን ወይ ምጽዓን ኣይተኻእለን። ኣብዞም ድምርታት ቅድሚ ምምርኳስኩም ኣሐድሱ ወይ መእተዊ መርምሩ።',
    so: 'Macluumaadka hantida qaar akoonkan uma furna ama lama soo rari karin. Dib u cusboonaysii ama hubi gelitaankaaga ka hor intaadan ku tiirsanaan wadartaan.',
    ar: 'بعض معلومات المحفظة غير متاحة لهذا الحساب أو تعذر تحميلها. حدّث الصفحة أو تحقق من صلاحيات الوصول قبل الاعتماد على هذه الإجماليات.',
    sw: 'Baadhi ya taarifa za mali hazipatikani kwa akaunti hii au hazikuweza kupakiwa. Onyesha upya au kagua ufikiaji kabla ya kutegemea jumla hizi.',
  },
  'AGENT WORKSPACE': {
    am: 'የወኪል የሥራ ቦታ', om: 'IDDOO HOJII BAKKA BUʼAA', ti: 'ቦታ ስራሕ ወኪል', so: 'GOOBTA SHAQADA WAKIILKA', ar: 'مساحة عمل الوكيل', sw: 'ENEO LA KAZI LA WAKALA',
  },
  'Your activity snapshot': {
    am: 'የእንቅስቃሴዎ አጭር ማጠቃለያ', om: 'Cuunfaa sochii keessanii', ti: 'ሓጺር ርእይቶ ንጥፈታትኩም', so: 'Dulmarka dhaqdhaqaaqaaga', ar: 'لمحة عن نشاطك', sw: 'Muhtasari wa shughuli zako',
  },
  'A live summary of records available to your account. Commission figures reflect approval status, not confirmed payment.': {
    am: 'ለመለያዎ የሚገኙ መዝገቦች ቀጥታ ማጠቃለያ ነው። የኮሚሽን ቁጥሮች የፈቃድ ሁኔታን ያሳያሉ እንጂ ክፍያ መፈጸሙን አያረጋግጡም።',
    om: 'Cuunfaa yeroo ammaa galmeewwan herrega keessaniif argamanidha. Lakkoofsi koomishinii haala raggaasifamuu agarsiisa malee kaffaltiin mirkanaaʼe jechuu miti.',
    ti: 'እዚ ንሕሳብኩም ዝርከቡ መዝገባት ናይ ሕጂ ሓፈሻዊ ርእይቶ እዩ። ቁጽሪ ኮሚሽን ኩነታት ምጽዳቕ የርኢ እምበር ክፍሊት ከምዝተፈጸመ ኣየረጋግጽን።',
    so: 'Waa soo koobid toos ah oo ku saabsan diiwaannada akoonkaaga u furan. Tirooyinka guddigu waxay muujiyaan heerka oggolaanshaha, mana xaqiijiyaan lacag-bixin.',
    ar: 'هذا ملخص مباشر للسجلات المتاحة لحسابك. تعكس أرقام العمولة حالة الموافقة ولا تؤكد استلام الدفع.',
    sw: 'Huu ni muhtasari wa moja kwa moja wa rekodi zinazopatikana kwa akaunti yako. Takwimu za kamisheni zinaonyesha hali ya idhini, si uthibitisho wa malipo.',
  },
  'Some activity records are unavailable to this account or could not be loaded. Refresh or check access before relying on these totals.': {
    am: 'አንዳንድ የእንቅስቃሴ መዝገቦች ለዚህ መለያ አይገኙም ወይም ሊጫኑ አልቻሉም። በእነዚህ ድምሮች ላይ ከመመርኮዝዎ በፊት ያድሱ ወይም መዳረሻዎን ያረጋግጡ።',
    om: 'Galmeewwan sochii tokko tokko herrega kanaaf hin jiru yookaan feʼamuu hin dandeenye. Idaʼama kana irratti hirkachuu dura haaromsi yookaan seensa mirkaneessi.',
    ti: 'ገለ መዝገባት ንጥፈት ንእዚ ሕሳብ ኣይርከቡን ወይ ምጽዓን ኣይተኻእለን። ኣብዞም ድምርታት ቅድሚ ምምርኳስኩም ኣሐድሱ ወይ መእተዊ መርምሩ።',
    so: 'Diiwaannada dhaqdhaqaaqa qaar akoonkan uma furna ama lama soo rari karin. Dib u cusboonaysii ama hubi gelitaankaaga ka hor intaadan ku tiirsanaan wadartaan.',
    ar: 'بعض سجلات النشاط غير متاحة لهذا الحساب أو تعذر تحميلها. حدّث الصفحة أو تحقق من صلاحيات الوصول قبل الاعتماد على هذه الإجماليات.',
    sw: 'Baadhi ya rekodi za shughuli hazipatikani kwa akaunti hii au hazikuweza kupakiwa. Onyesha upya au kagua ufikiaji kabla ya kutegemea jumla hizi.',
  },
  'Overdue maintenance SLA queue': {
    am: 'የጥገና ጊዜ ገደብ ያለፈባቸው ጥያቄዎች', om: 'Tarree suphaa yeroo SLA darbe', ti: 'ዝርዝር ጽገና ግዜ SLA ዝሓለፎ', so: 'Liiska dayactirka waqtiga SLA dhaafay', ar: 'قائمة الصيانة المتجاوزة لمهلة الخدمة', sw: 'Foleni ya matengenezo iliyovuka muda wa SLA',
  },
  'Your shift schedule could not be loaded. Use Refresh to try again.': {
    am: 'የፈረቃ መርሐ ግብርዎን መጫን አልተቻለም። እንደገና ለመሞከር አድስን ይጠቀሙ።',
    om: 'Sagantaa jijjiirraa hojii keessanii feʼuun hin dandaʼamne. Irra deebiʼuuf Haaromsi fayyadamaa.',
    ti: 'መደብ ሽፍትኩም ምጽዓን ኣይተኻእለን። ንምድጋም ኣሐድስ ተጠቀሙ።',
    so: 'Jadwalka shaqada lama soo rari karin. Isticmaal Dib u cusboonaysii si aad mar kale isugu daydo.',
    ar: 'تعذر تحميل جدول نوباتك. استخدم «تحديث» لإعادة المحاولة.',
    sw: 'Ratiba ya zamu yako haikuweza kupakiwa. Tumia Onyesha upya kujaribu tena.',
  },
  'Request a time correction': {
    am: 'የሰዓት ማስተካከያ ይጠይቁ', om: 'Sirreeffama saʼaa gaafadhaa', ti: 'ምትእርራይ ሰዓት ሕተቱ', so: 'Codso sixitaanka waqtiga', ar: 'اطلب تصحيح الوقت', sw: 'Omba marekebisho ya muda',
  },
  'Submit a work activity report': {
    am: 'የሥራ እንቅስቃሴ ሪፖርት ያስገቡ', om: 'Gabaasa sochii hojii galchaa', ti: 'ሪፖርት ንጥፈት ስራሕ ኣቕርቡ', so: 'Gudbi warbixinta hawsha shaqada', ar: 'أرسل تقرير نشاط العمل', sw: 'Wasilisha ripoti ya shughuli za kazi',
  },
  'Worker payment records could not be loaded. Select Refresh to try again.': {
    am: 'የሠራተኛ ክፍያ መዝገቦችን መጫን አልተቻለም። እንደገና ለመሞከር አድስን ይምረጡ።',
    om: 'Galmeewwan kaffaltii hojjetaa feʼuun hin dandaʼamne. Irra deebiʼuuf Haaromsi filadhaa.',
    ti: 'መዝገባት ክፍሊት ሰራሕተኛ ምጽዓን ኣይተኻእለን። ንምድጋም ኣሐድስ ምረጹ።',
    so: 'Diiwaannada lacag-bixinta shaqaalaha lama soo rari karin. Dooro Dib u cusboonaysii si aad mar kale isugu daydo.',
    ar: 'تعذر تحميل سجلات مدفوعات العامل. اختر «تحديث» لإعادة المحاولة.',
    sw: 'Rekodi za malipo ya mfanyakazi hazikuweza kupakiwa. Chagua Onyesha upya ili kujaribu tena.',
  },
  'Landlord rent & deposit statements': {
    am: 'የአከራይ የኪራይና የተቀማጭ መግለጫዎች', om: 'Ibsa kiraa fi wabii abbaa qabeenyaa', ti: 'መግለጺ ክራይን ተቐማጢን ኣከራዪ', so: 'Warbixinnada kirada iyo deebaajiga mulkiilaha', ar: 'كشوف إيجار المالك والودائع', sw: 'Taarifa za kodi na amana za mwenye nyumba',
  },
  'Assigned work orders': {
    am: 'የተመደቡ የሥራ ትዕዛዞች', om: 'Ajaja hojii ramadaman', ti: 'ትእዛዛት ስራሕ ዝተመደቡ', so: 'Amarrada shaqada ee laguu qoondeeyey', ar: 'أوامر العمل المعيّنة', sw: 'Maagizo ya kazi uliyopangiwa',
  },
  'Vendor additional-cost and invoice review': {
    am: 'የአቅራቢ ተጨማሪ ወጪና ደረሰኝ ግምገማ', om: 'Gamaaggama baasii dabalataa fi nagahee dhiyeessaa', ti: 'ግምገማ ተወሳኺ ወጻኢን ደረሰኝን ሻጣይ', so: 'Dib-u-eegista kharash dheeraad ah iyo qaansheegta iibiyaha', ar: 'مراجعة التكاليف الإضافية وفواتير المورّد', sw: 'Ukaguzi wa gharama za ziada na ankara za msambazaji',
  },
  'Additional costs and invoices remain separate Finance decisions. Invoice mismatches must be explicitly resolved before invoice approval.': {
    am: 'ተጨማሪ ወጪዎችና ደረሰኞች የፋይናንስ ቡድን የተለያዩ ውሳኔዎች ናቸው። ደረሰኝ ከመጽደቁ በፊት የመጠን ልዩነቶች በግልጽ መፍታት አለባቸው።',
    om: 'Baasii dabalataa fi nagaheen murtii Faayinaansii adda addaa taʼanii turu. Nagaheen raggaʼuu dura garaagarummaan isaa ifatti furamuu qaba.',
    ti: 'ወሰኽቲ ወጻኢታትን ደረሰናትን ፍሉይ ውሳነታት ፋይናንስ ኮይኖም ይቕጽሉ። ደረሰኝ ቅድሚ ምጽዳቑ ዘይምስምማዕ መጠን ብግልጺ ክፍታሕ ኣለዎ።',
    so: 'Kharashyada dheeraadka ah iyo qaansheegaduhu waa go’aanno Maaliyadeed oo kala gaar ah. Kala duwanaanshaha qaansheegta waa in si cad loo xalliyaa ka hor ansixinteeda.',
    ar: 'تظل التكاليف الإضافية والفواتير قرارات مالية منفصلة. يجب حل أي اختلاف في الفاتورة صراحةً قبل اعتمادها.',
    sw: 'Gharama za ziada na ankara hubaki kuwa maamuzi tofauti ya Fedha. Tofauti za ankara lazima zisuluhishwe wazi kabla ya kuidhinisha ankara.',
  },
  'Additional-cost requests': {
    am: 'የተጨማሪ ወጪ ጥያቄዎች', om: 'Gaaffii baasii dabalataa', ti: 'ሕቶታት ወሰኽቲ ወጻኢታት', so: 'Codsiyada kharashka dheeraadka ah', ar: 'طلبات التكاليف الإضافية', sw: 'Maombi ya gharama za ziada',
  },
  'Invoice amount mismatches': {
    am: 'የደረሰኝ መጠን አለመዛመድ', om: 'Walsimsiisuu dhabuu hamma nagahee', ti: 'ዘይምስምማዕ መጠን ደረሰኝ', so: 'Kala duwanaanshaha qaddarka qaansheegta', ar: 'اختلاف مبالغ الفواتير', sw: 'Kutolingana kwa kiasi cha ankara',
  },
  'Matched invoices awaiting approval': {
    am: 'የተዛመዱ ደረሰኞች ፈቃድ እየጠበቁ ነው', om: 'Nagaheewwan wal-simsiifaman raggaʼuu eeggachaa jiru', ti: 'ዝተሰማምዑ ደረሰናት ምጽዳቕ ይጽበዩ ኣለዉ', so: 'Qaansheegyada la waafajiyey waxay sugayaan oggolaansho', ar: 'الفواتير المطابقة بانتظار الموافقة', sw: 'Ankara zilizolinganishwa zinasubiri idhini',
  },
  'Webhook notification delivery': {
    am: 'የWebhook ማሳወቂያ ማድረስ', om: 'Geessuu beeksisa webhook', ti: 'ምብጻሕ ምልክታ webhook', so: 'Gaarsiinta ogeysiiska webhook', ar: 'تسليم إشعار Webhook', sw: 'Uwasilishaji wa arifa ya webhook',
  },
  'Delivery retries use bounded backoff. Manual retries are audited and keep the original notification ID as the downstream idempotency key.': {
    am: 'ዳግም ማድረስ በተወሰነ የጊዜ ልዩነት ይከናወናል። በእጅ የሚደረጉ ዳግም ሙከራዎች በኦዲት ይመዘገባሉ፤ የመጀመሪያውን የማሳወቂያ መለያ ለቀጣይ ስርዓት የአንድ-ጊዜ መለያ አድርገው ይጠብቃሉ።',
    om: 'Irra yaaliin geessuu yeroo murtaaʼe keessatti suuta-suuta dabala. Irra yaaliin harkaan taasifamu odiitii keessatti galmaaʼa; ID beeksisa jalqabaa furtuu idempotency sirna itti aanu keessatti ni tursa.',
    ti: 'ዳግማይ ምብጻሕ ብውሱን ክፍተት ግዜ ይውስኽ። ብኢድ ዝግበር ዳግማይ ፈተነ ኣብ ኦዲት ይምዝገብ፤ ናይ መጀመርታ መለለዪ ምልክታ ከም መፍትሕ ኣንድ-ግዜ ኣጠቓቕማ ንቀጻሊ ስርዓት ይሕዝ።',
    so: 'Dib-u-dirista waxaa lagu celiyaa waqtiyo kordhaya oo xaddidan. Dib-u-dayga gacanta waa la diiwaangeliyaa, wuxuuna hayaa aqoonsigii ogeysiiska asalka ahaa si nidaamka xiga uusan laba jeer u fulin.',
    ar: 'تُعاد محاولات التسليم بتأخير تصاعدي محدود. تُسجّل المحاولات اليدوية في سجل التدقيق، وتحتفظ بمعرّف الإشعار الأصلي كمفتاح لمنع التكرار في النظام اللاحق.',
    sw: 'Majaribio ya kutuma tena hutumia muda wa kusubiri unaoongezeka kwa kiwango maalum. Majaribio ya mkono hukaguliwa na huhifadhi kitambulisho asili cha arifa kama ufunguo wa kuzuia marudio kwenye mfumo unaofuata.',
  },
  'Choose property-vendor business': {
    am: 'የንብረት አቅራቢ ንግድ ይምረጡ', om: 'Daldala dhiyeessaa qabeenyaa filadhaa', ti: 'ንግዲ ኣቕራቢ ንብረት ምረጹ', so: 'Dooro ganacsiga iibiyaha hantida', ar: 'اختر شركة مورّد العقارات', sw: 'Chagua biashara ya msambazaji wa mali',
  },
  'Signed-in sessions': {
    am: 'የገቡባቸው ክፍለ ጊዜዎች', om: 'Yeroo seensaa', ti: 'ክፍለ ግዜ ዝኣተኹሙሉ', so: 'Kulammada aad gashay', ar: 'جلسات تسجيل الدخول', sw: 'Vipindi ulivyoingia',
  },
  'Review recent sessions for your account and end any session you do not recognize.': {
    am: 'የመለያዎን የቅርብ ጊዜ ክፍለ ጊዜዎች ይመልከቱ፤ የማያውቁትን ክፍለ ጊዜ ያቋርጡ።',
    om: 'Yeroo seensaa dhiheenyaa herrega keessanii ilaalaa; yeroo hin beekne kamiyyuu cufaa.',
    ti: 'ናይ ሕሳብኩም ናይ ቀረባ ክፍለ ግዜ ርኣዩ፤ ዘይትፈልጥዎ ክፍለ ግዜ ዕጸዉ።',
    so: 'Dib u eeg kulammadii ugu dambeeyey ee akoonkaaga, kana bax kulan kasta oo aadan aqoonsan.',
    ar: 'راجع الجلسات الأخيرة لحسابك وأنهِ أي جلسة لا تعرفها.',
    sw: 'Kagua vipindi vya hivi karibuni vya akaunti yako na umalize kipindi chochote usichokitambua.',
  },
  'Open a support case': {
    am: 'የድጋፍ ጉዳይ ይክፈቱ', om: 'Dhimmicha deeggarsaa banii', ti: 'ጉዳይ ደገፍ ክፈቱ', so: 'Fur kiis taageero', ar: 'افتح حالة دعم', sw: 'Fungua kesi ya usaidizi',
  },
  'Safety, fraud, privacy and legal cases are treated as urgent. Agent complaints are not assigned to the Agent named.': {
    am: 'የደህንነት፣ የማጭበርበር፣ የግላዊነትና የሕግ ጉዳዮች አስቸኳይ እንደሆኑ ይታያሉ። የወኪል ቅሬታዎች በቅሬታው ላይ ለተጠቀሰው ወኪል አይመደቡም።',
    om: 'Dhimmoota nageenyaa, gowwoomsaa, iccitii fi seeraa ariifachiisaa taʼanii ilaalamu. Komiin bakka buʼaa bakka buʼaa maqaan isaa eerameef hin ramadamu.',
    ti: 'ጉዳያት ድሕነት፣ ምትላል፣ ብሕታዊነትን ሕግን ኣስቸኳይ ኮይኖም ይረኣዩ። ጥርዓን ወኪል ነቲ ዝተጠቕሰ ወኪል ኣይምደብን።',
    so: 'Kiisaska badbaadada, khiyaanada, asturnaanta iyo sharciga waxaa loo tixgeliyaa degdeg. Cabashooyinka wakiilka looma qoondeeyo wakiilka lagu magacaabay.',
    ar: 'تُعامل حالات السلامة والاحتيال والخصوصية والشؤون القانونية على أنها عاجلة. ولا تُسند شكاوى الوكلاء إلى الوكيل المذكور فيها.',
    sw: 'Kesi za usalama, ulaghai, faragha na sheria huchukuliwa kuwa za dharura. Malalamiko kuhusu wakala hayapelekwi kwa wakala aliyetajwa.',
  },
  'My cases': {
    am: 'የእኔ ጉዳዮች', om: 'Dhimmoota koo', ti: 'ጉዳያተይ', so: 'Kiisaskayga', ar: 'حالاتي', sw: 'Kesi zangu',
  },
  'Support queue': {
    am: 'የድጋፍ ወረፋ', om: 'Tarree eegaa deeggarsaa', ti: 'ረድፊ ደገፍ', so: 'Safka taageerada', ar: 'قائمة انتظار الدعم', sw: 'Foleni ya usaidizi',
  },
  'Case descriptions and sensitive details remain hidden until a different authorized reviewer approves a 15-minute access window.': {
    am: 'የጉዳይ መግለጫዎችና ስሱ ዝርዝሮች ሌላ ፈቃድ ያለው ገምጋሚ የ15 ደቂቃ የመዳረሻ ጊዜ እስኪያጸድቅ ድረስ ይደበቃሉ።',
    om: 'Ibsi dhimmaa fi odeeffannoon miira-qabeessi hanga gamaaggamaan hayyama qabu kan biraa daqiiqaa 15f seensa raggaasuutti dhokata.',
    ti: 'መግለጺ ጉዳይን ስሱ ዝርዝራትን ካልእ ፍቓድ ዘለዎ ገምጋሚ ናይ 15 ደቒቕ መእተዊ ክሳብ ዘጽድቕ ተሓቢኦም ይጸንሑ።',
    so: 'Sharaxaadda kiiska iyo faahfaahinta xasaasiga ah way qarsoon yihiin ilaa dib-u-eegaha kale ee la oggolaaday uu ansixiyo gelitaan 15 daqiiqo ah.',
    ar: 'تظل أوصاف الحالة والتفاصيل الحساسة مخفية حتى يوافق مراجع مخوّل آخر على نافذة وصول مدتها 15 دقيقة.',
    sw: 'Maelezo ya kesi na taarifa nyeti hubaki zimefichwa hadi mkaguzi mwingine aliyeidhinishwa aidhinishe ufikiaji wa dakika 15.',
  },
  'Appeal review queue': {
    am: 'የይግባኝ ግምገማ ወረፋ', om: 'Tarree gamaaggama olmaa', ti: 'ረድፊ ግምገማ ይግባይ', so: 'Safka dib-u-eegista racfaanka', ar: 'قائمة مراجعة الاستئنافات', sw: 'Foleni ya ukaguzi wa rufaa',
  },
  'Appeals are reviewed by an authorized person other than the original resolution author. Case details require independent temporary approval.': {
    am: 'ይግባኞች የመጀመሪያውን ውሳኔ በጻፈው ሰው ሳይሆን በሌላ ፈቃድ ባለው ሰው ይገመገማሉ። የጉዳይ ዝርዝሮችን ለማየት ጊዜያዊ ገለልተኛ ፈቃድ ያስፈልጋል።',
    om: 'Olmaan nama murtii jalqabaa barreesse irraa adda taʼe kan hayyamameen gamaaggamama. Balʼina dhimmaa arguun hayyama yeroo gabaabaa of dandaʼe barbaada.',
    ti: 'ይግባይ በቲ ቀዳማይ ውሳነ ዝጸሓፈ ሰብ ዘይኮነስ ብካልእ ፍቓድ ዘለዎ ሰብ ይግምገም። ዝርዝር ጉዳይ ንምርኣይ ናጻ ግዝያዊ ፍቓድ የድሊ።',
    so: 'Racfaan waxaa dib u eegaya qof la oggolaaday oo aan ahayn kii qoray go’aankii hore. Faahfaahinta kiisku waxay u baahan tahay oggolaansho ku-meel-gaar ah oo madax-bannaan.',
    ar: 'يراجع الاستئناف شخص مخوّل غير صاحب القرار الأصلي. ويتطلب الاطلاع على تفاصيل الحالة موافقة مؤقتة مستقلة.',
    sw: 'Rufaa hukaguliwa na mtu aliyeidhinishwa tofauti na aliyeandika uamuzi wa awali. Maelezo ya kesi yanahitaji idhini huru ya muda.',
  },
  'Sensitive-access approvals': {
    am: 'ለስሱ መረጃ የመዳረሻ ፈቃዶች', om: 'Hayyama seensa odeeffannoo miira-qabeessaa', ti: 'ፍቓዳት መእተዊ ስሱ ሓበሬታ', so: 'Oggolaanshaha gelitaanka xogta xasaasiga ah', ar: 'موافقات الوصول إلى البيانات الحساسة', sw: 'Idhini za ufikiaji wa taarifa nyeti',
  },
  'Sensitive access has expired. Request a new independent approval to view case details.': {
    am: 'ለስሱ መረጃ የነበረው መዳረሻ ጊዜው አልፏል። የጉዳዩን ዝርዝር ለማየት አዲስ ገለልተኛ ፈቃድ ይጠይቁ።',
    om: 'Seensaan odeeffannoo miira-qabeessaa dhumeera. Balʼina dhimmaa ilaaluuf hayyama of dandaʼe haaraa gaafadhaa.',
    ti: 'መእተዊ ስሱ ሓበሬታ ግዜኡ ኣብቂዑ። ዝርዝር ጉዳይ ንምርኣይ ሓድሽ ናጻ ፍቓድ ሕተቱ።',
    so: 'Gelitaankii xogta xasaasiga ahi wuu dhacay. Codso oggolaansho cusub oo madax-bannaan si aad u aragto faahfaahinta kiiska.',
    ar: 'انتهت صلاحية الوصول إلى البيانات الحساسة. اطلب موافقة مستقلة جديدة لعرض تفاصيل الحالة.',
    sw: 'Ufikiaji wa taarifa nyeti umeisha muda wake. Omba idhini huru mpya ili kuona maelezo ya kesi.',
  },
  'Resolution record': {
    am: 'የመፍትሄ መዝገብ', om: 'Galmee furmaataa', ti: 'መዝገብ ፍታሕ', so: 'Diiwaanka xalinta', ar: 'سجل الحل', sw: 'Rekodi ya utatuzi',
  },
  'Independent appeal review': {
    am: 'ገለልተኛ የይግባኝ ግምገማ', om: 'Gamaaggama olmaa of dandaʼe', ti: 'ናጻ ግምገማ ይግባይ', so: 'Dib-u-eegis racfaan oo madax-bannaan', ar: 'مراجعة مستقلة للاستئناف', sw: 'Ukaguzi huru wa rufaa',
  },
  'Case timeline': {
    am: 'የጉዳይ የጊዜ ሰሌዳ', om: 'Tartiiba yeroo dhimmaa', ti: 'ቅደም ተኸተል ግዜ ጉዳይ', so: 'Jadwalka dhacdooyinka kiiska', ar: 'الجدول الزمني للحالة', sw: 'Mfuatano wa muda wa kesi',
  },
  'This workspace is unavailable for your account or deployment.': {
    am: 'ይህ የሥራ ቦታ ለመለያዎ ወይም ለዚህ ማሰማራት አይገኝም።', om: 'Iddoo hojii kun herrega keessaniif yookaan qindaaʼina kanaaf hin jiru.', ti: 'እዚ ቦታ ስራሕ ንሕሳብኩም ወይ ንእዚ ምትካል ኣይርከብን።', so: 'Goobtan shaqo uma furna akoonkaaga ama dejintan.', ar: 'مساحة العمل هذه غير متاحة لحسابك أو لهذا النشر.', sw: 'Eneo hili la kazi halipatikani kwa akaunti yako au usambazaji huu.',
  },
  'Engagement terms submitted for independent Finance review.': {
    am: 'የሥራ ተሳትፎ ውሎች ለገለልተኛ የፋይናንስ ግምገማ ቀርበዋል።', om: 'Haalotni hojii hirmaannaa gamaaggama Faayinaansii of dandaʼeef dhiyaataniiru.', ti: 'ውዕላት ስምምዕ ስራሕ ንናጻ ግምገማ ፋይናንስ ቀሪቦም።', so: 'Shuruudaha hawlgalka waxaa loo gudbiyey dib-u-eegis maaliyadeed oo madax-bannaan.', ar: 'أُرسلت شروط المشاركة لمراجعة مالية مستقلة.', sw: 'Masharti ya ushiriki yamewasilishwa kwa ukaguzi huru wa Fedha.',
  },
  'Your support request was sent to AfroLife.': {
    am: 'የድጋፍ ጥያቄዎ ወደ AfroLife ተልኳል።', om: 'Gaaffiin deeggarsaa keessan gara AfroLife ergameera.', ti: 'ሕቶ ደገፍኩም ናብ AfroLife ተላኢኹ።', so: 'Codsigaaga taageerada waxaa loo diray AfroLife.', ar: 'أُرسل طلب الدعم إلى AfroLife.', sw: 'Ombi lako la usaidizi limetumwa kwa AfroLife.',
  },
  'Your support case was submitted. Safety, fraud, privacy and legal cases are escalated as urgent.': {
    am: 'የድጋፍ ጉዳይዎ ቀርቧል። የደህንነት፣ የማጭበርበር፣ የግላዊነትና የሕግ ጉዳዮች አስቸኳይ ተብለው ይቀርባሉ።',
    om: 'Dhimmichi deeggarsaa keessan dhiyaateera. Dhimmoota nageenyaa, gowwoomsaa, iccitii fi seeraa ariifachiisaatti ol-kaafamu.',
    ti: 'ጉዳይ ደገፍኩም ቀሪቡ። ጉዳያት ድሕነት፣ ምትላል፣ ብሕታዊነትን ሕግን ከም ኣስቸኳይ ብቐዳምነት ይለዓሉ።',
    so: 'Kiiskaaga taageerada waa la gudbiyey. Kiisaska badbaadada, khiyaanada, asturnaanta iyo sharciga waxaa loo dallacsiinayaa degdeg.',
    ar: 'تم إرسال حالة الدعم. تُصعّد حالات السلامة والاحتيال والخصوصية والشؤون القانونية كحالات عاجلة.',
    sw: 'Kesi yako ya usaidizi imewasilishwa. Kesi za usalama, ulaghai, faragha na sheria hupandishwa kama za dharura.',
  },
  'Resolution recorded and the user was notified.': {
    am: 'መፍትሄው ተመዝግቦ ተጠቃሚው ተነግሮታል።', om: 'Furmaanni galmaaʼeera; fayyadamaanis beeksifameera.', ti: 'ፍታሕ ተመዝጊቡ፣ ተጠቃሚ ድማ ተሓቢሩ።', so: 'Xalka waa la diiwaangeliyey, isticmaalahana waa la ogeysiiyey.', ar: 'تم تسجيل الحل وإخطار المستخدم.', sw: 'Utatuzi umerekodiwa na mtumiaji amearifiwa.',
  },
  'Independent appeal review recorded and the user was notified.': {
    am: 'ገለልተኛ የይግባኝ ግምገማ ተመዝግቦ ተጠቃሚው ተነግሮታል።',
    om: 'Gamaaggamni olmaa of dandaʼe galmaaʼeera; fayyadamaanis beeksifameera.',
    ti: 'ግምገማ ይግባይ ናጻ ተመዝጊቡ፣ ተጠቃሚ ድማ ተሓቢሩ።',
    so: 'Dib-u-eegista racfaanka madax-bannaan waa la diiwaangeliyey, isticmaalahana waa la ogeysiiyey.',
    ar: 'تم تسجيل مراجعة الاستئناف المستقلة وإخطار المستخدم.',
    sw: 'Ukaguzi huru wa rufaa umerekodiwa na mtumiaji amearifiwa.',
  },
  'Your time correction was submitted for independent review.': {
    am: 'የሰዓት ማስተካከያ ጥያቄዎ ለገለልተኛ ግምገማ ቀርቧል።', om: 'Gaaffiin sirreeffama saʼaa keessanii gamaaggama of dandaʼeef dhiyaateera.', ti: 'ሕቶ ምትእርራይ ሰዓትኩም ንናጻ ግምገማ ቀሪቡ።', so: 'Codsigaaga sixitaanka waqtiga waxaa loo gudbiyey dib-u-eegis madax-bannaan.', ar: 'أُرسل طلب تصحيح الوقت للمراجعة المستقلة.', sw: 'Ombi lako la marekebisho ya muda limewasilishwa kwa ukaguzi huru.',
  },
  'Your leave or availability request was submitted for review.': {
    am: 'የፈቃድ ወይም የመገኘት ጥያቄዎ ለግምገማ ቀርቧል።', om: 'Gaaffiin boqonnaa yookaan argama keessanii gamaaggamaaf dhiyaateera.', ti: 'ሕቶ ዕረፍቲ ወይ ተረኽቦኹም ንግምገማ ቀሪቡ።', so: 'Codsigaaga fasaxa ama helitaanka shaqada waxaa loo gudbiyey dib-u-eegis.', ar: 'أُرسل طلب الإجازة أو التوفر للمراجعة.', sw: 'Ombi lako la likizo au upatikanaji limewasilishwa kwa ukaguzi.',
  },
  'Worker shift scheduled.': {
    am: 'የሠራተኛ ፈረቃ ተመድቧል።', om: 'Jijjiirraan hojii hojjetaa karoorfameera.', ti: 'ሽፍት ሰራሕተኛ ተመዲቡ።', so: 'Wareegga shaqaalaha waa la jadwaleeyey.', ar: 'تمت جدولة نوبة العامل.', sw: 'Zamu ya mfanyakazi imepangwa.',
  },
  'Workforce policy draft saved for independent approval.': {
    am: 'ረቂቅ የሠራተኛ ፖሊሲ ለገለልተኛ ፈቃድ ተቀምጧል።', om: 'Wixineen imaammata humna hojii raggaasisa of dandaʼeef olkaaʼameera.', ti: 'ረቂቕ ፖሊሲ ሓይሊ ሰራሕተኛ ንናጻ ምጽዳቕ ተዓቂቡ።', so: 'Qabyo-qoraalka siyaasadda shaqaalaha waxaa loo kaydiyey ansixin madax-bannaan.', ar: 'حُفظت مسودة سياسة القوى العاملة للموافقة المستقلة.', sw: 'Rasimu ya sera ya wafanyakazi imehifadhiwa kwa idhini huru.',
  },
  'Encrypted payroll export generated. It has not been filed or paid.': {
    am: 'የተመሰጠረ የደመወዝ ውሂብ ማውጫ ተፈጥሯል። ግብር አልቀረበበትም ወይም ክፍያ አልተፈጸመም።',
    om: 'Baafanni kaffaltii mindaa iccitiin eegame uumameera. Hin galmoofne yookaan kaffaltiin hin raawwatamne.',
    ti: 'ዝተመስጠረ ምውጻእ ደሞዝ ተፈጢሩ። ግብሪ ኣይቀረበን ወይ ክፍሊት ኣይተፈጸመን።',
    so: 'Faylka mushaharka ee sirgashan waa la sameeyey. Lama gudbin mana la bixin.',
    ar: 'تم إنشاء ملف الرواتب المشفّر. لم يُقدّم ولم تُصرف أي مبالغ.',
    sw: 'Faili fiche ya mishahara imeundwa. Haijawasilishwa wala kulipwa.',
  },
  'Maintenance request recorded.': {
    am: 'የጥገና ጥያቄው ተመዝግቧል።', om: 'Gaaffiin suphaa galmaaʼeera.', ti: 'ሕቶ ጽገና ተመዝጊቡ።', so: 'Codsiga dayactirka waa la diiwaangeliyey.', ar: 'تم تسجيل طلب الصيانة.', sw: 'Ombi la matengenezo limerekodiwa.',
  },
  'Role access is already up to date.': {
    am: 'የሚና መዳረሻ አስቀድሞ ወቅታዊ ነው።', om: 'Seensaan gahee duraan haaromfameera.', ti: 'መእተዊ ሚና ድሮ እዋናዊ እዩ።', so: 'Gelitaanka doorku hore ayuu u cusboonaaday.', ar: 'صلاحيات الدور محدّثة بالفعل.', sw: 'Ufikiaji wa jukumu tayari umesasishwa.',
  },
  'Role access saved.': {
    am: 'የሚና መዳረሻ ተቀምጧል።', om: 'Seensaan gahee olkaaʼameera.', ti: 'መእተዊ ሚና ተዓቂቡ።', so: 'Gelitaanka doorka waa la kaydiyey.', ar: 'تم حفظ صلاحيات الدور.', sw: 'Ufikiaji wa jukumu umehifadhiwa.',
  },
  'Service package created.': {
    am: 'የአገልግሎት ጥቅሉ ተፈጥሯል።', om: 'Paakejiin tajaajilaa uumameera.', ti: 'ጥሙር ኣገልግሎት ተፈጢሩ።', so: 'Xirmada adeegga waa la sameeyey.', ar: 'تم إنشاء حزمة الخدمة.', sw: 'Kifurushi cha huduma kimeundwa.',
  },
  'Service package configuration saved.': {
    am: 'የአገልግሎት ጥቅል ውቅር ተቀምጧል።', om: 'Qindaaʼinni paakejii tajaajilaa olkaaʼameera.', ti: 'ምቅናዕ ጥሙር ኣገልግሎት ተዓቂቡ።', so: 'Dejinta xirmada adeegga waa la kaydiyey.', ar: 'تم حفظ إعدادات حزمة الخدمة.', sw: 'Mipangilio ya kifurushi cha huduma imehifadhiwa.',
  },
  'Tenant registered in provisioning state. Verify its deployment before activation.': {
    am: 'ተከራዩ በማቅረብ ሁኔታ ተመዝግቧል። ከማንቃትዎ በፊት ማሰማራቱን ያረጋግጡ።',
    om: 'Tenant haala qopheessuu keessatti galmaaʼeera. Hojii irra oolchuu dura qindaaʼina isaa mirkaneessaa.',
    ti: 'ተናንት ኣብ ኩነታት ምድላው ተመዝጊቡ። ቅድሚ ምንቃሑ ምትካሉ ኣረጋግጹ።',
    so: 'Kiraystaha waxaa lagu diiwaangeliyey xaaladda diyaarinta. Xaqiiji dejintiisa ka hor hawlgelinta.',
    ar: 'سُجّل المستأجر في حالة التجهيز. تحقّق من نشره قبل التفعيل.',
    sw: 'Mpangaji amesajiliwa katika hali ya maandalizi. Thibitisha usambazaji wake kabla ya kuwezesha.',
  },
  'Super Admin assigned to this tenant.': {
    am: 'ሱፐር አስተዳዳሪ ለዚህ ተከራይ ተመድቧል።', om: 'Super Admin tenant kanaaf ramadameera.', ti: 'Super Admin ንእዚ ተናንት ተመዲቡ።', so: 'Super Admin ayaa loo qoondeeyey kiraystahan.', ar: 'تم تعيين مسؤول فائق لهذا المستأجر.', sw: 'Super Admin amekabidhiwa mpangaji huyu.',
  },
  'Tenant capability assignment recorded. No database connection or data-plane action was performed.': {
    am: 'የተከራይ ችሎታ ምደባ ተመዝግቧል። ምንም የውሂብ ጎታ ግንኙነት ወይም የውሂብ አካባቢ እርምጃ አልተፈጸመም።',
    om: 'Ramaddiin dandeettii tenant galmaaʼeera. Walqunnamtiin kuusdeetaa yookaan tarkaanfiin daataa hin raawwatamne.',
    ti: 'ምደባ ክእለት ተናንት ተመዝጊቡ። ምርኻብ ዳታቤዝ ወይ ስጉምቲ ዳታ ኣይተፈጸመን።',
    so: 'Meelaynta awoodda kiraystaha waa la diiwaangeliyey. Wax xiriir xogeed ama hawl xogeed lama samayn.',
    ar: 'تم تسجيل تعيين صلاحية المستأجر. لم يُنشأ اتصال بقاعدة البيانات ولم يُنفّذ أي إجراء على البيانات.',
    sw: 'Ugawaji wa uwezo wa mpangaji umerekodiwa. Hakukuwa na muunganisho wa hifadhidata wala hatua ya data iliyotekelezwa.',
  },
  'Deployment registration submitted to the Global System Admin.': {
    am: 'የማሰማራት ምዝገባ ለዓለም አቀፍ ሲስተም አስተዳዳሪ ቀርቧል።',
    om: 'Galmeen qindaaʼina hojii irra oolchuu gara Admin Sirna Addunyaatti ergameera.',
    ti: 'ምዝገባ ምትካል ናብ Global System Admin ቀሪቡ።',
    so: 'Diiwaangelinta dejinta waxaa loo gudbiyey Maamulaha Nidaamka Caalamiga ah.',
    ar: 'أُرسل تسجيل النشر إلى مسؤول النظام العالمي.',
    sw: 'Usajili wa usambazaji umewasilishwa kwa Msimamizi wa Mfumo wa Kimataifa.',
  },
  'Assigned entity modules saved.': {
    am: 'የተመደቡ የድርጅት ሞጁሎች ተቀምጠዋል።', om: 'Mojuulonni dhaabbataa ramadaman olkaaʼamaniiru.', ti: 'ሞጁላት ትካል ዝተመደቡ ተዓቂቦም።', so: 'Qaybaha hay’adda ee la qoondeeyey waa la kaydiyey.', ar: 'تم حفظ وحدات الكيان المعيّنة.', sw: 'Moduli za shirika zilizokabidhiwa zimehifadhiwa.',
  },
  'Platform service configuration saved.': {
    am: 'የመድረክ አገልግሎት ውቅር ተቀምጧል።', om: 'Qindaaʼinni tajaajila waltajjii olkaaʼameera.', ti: 'ምቅናዕ ኣገልግሎት መድረኽ ተዓቂቡ።', so: 'Dejinta adeegga madasha waa la kaydiyey.', ar: 'تم حفظ إعدادات خدمة المنصة.', sw: 'Mipangilio ya huduma ya jukwaa imehifadhiwa.',
  },
  'Tenant configuration saved.': {
    am: 'የተከራይ ውቅር ተቀምጧል።', om: 'Qindaaʼinni tenant olkaaʼameera.', ti: 'ምቅናዕ ተናንት ተዓቂቡ።', so: 'Dejinta kiraystaha waa la kaydiyey.', ar: 'تم حفظ إعدادات المستأجر.', sw: 'Mipangilio ya mpangaji imehifadhiwa.',
  },
  'Catalog product created in draft state. Activate it after review.': {
    am: 'የካታሎግ ምርቱ በረቂቅ ሁኔታ ተፈጥሯል። ከግምገማ በኋላ ያንቁት።',
    om: 'Oomishni kataloogii haala wixinee keessatti uumameera. Gamaaggama booda hojii irra oolchaa.',
    ti: 'ፍርያት ካታሎግ ኣብ ኩነታት ረቂቕ ተፈጢሩ። ድሕሪ ግምገማ ኣንቅሕዎ።',
    so: 'Badeecadda liiska waxaa lagu sameeyey xaalad qabyo ah. Dhaqaaji marka dib loo eego ka dib.',
    ar: 'أُنشئ منتج الكتالوج كمسودة. فعّله بعد المراجعة.',
    sw: 'Bidhaa ya katalogi imeundwa kama rasimu. Iwashe baada ya ukaguzi.',
  },
  'Catalog product updated.': {
    am: 'የካታሎግ ምርቱ ተዘምኗል።', om: 'Oomishni kataloogii haaromfameera.', ti: 'ፍርያት ካታሎግ ተሓዲሱ።', so: 'Badeecadda liiska waa la cusboonaysiiyey.', ar: 'تم تحديث منتج الكتالوج.', sw: 'Bidhaa ya katalogi imesasishwa.',
  },
  'Period checks complete. Confirm all findings with Finance before close.': {
    am: 'የወቅቱ ምርመራዎች ተጠናቀዋል። ከመዝጋትዎ በፊት ሁሉንም ግኝቶች ከፋይናንስ ጋር ያረጋግጡ።',
    om: 'Sakattaʼiinsi yeroo xumurameera. Cufuu dura argannoo hunda Faayinaansii waliin mirkaneessaa.',
    ti: 'ምርመራታት እዋን ተዛዚሞም። ቅድሚ ምዕጻው ኩሎም ርኽበታት ምስ ፋይናንስ ኣረጋግጹ።',
    so: 'Hubinta muddadu way dhammaatay. Maaliyadda kala xaqiiji dhammaan natiijooyinka ka hor xiritaanka.',
    ar: 'اكتملت فحوص الفترة. أكّد جميع النتائج مع فريق المالية قبل الإغلاق.',
    sw: 'Ukaguzi wa kipindi umekamilika. Thibitisha matokeo yote na Fedha kabla ya kufunga.',
  },
  'Service identity recorded. No secret value was stored.': {
    am: 'የአገልግሎት መለያ ተመዝግቧል። ምንም ሚስጥራዊ እሴት አልተቀመጠም።',
    om: 'Eenymyummaan tajaajilaa galmaaʼeera. Gatiin iccitii hin kuufamne.',
    ti: 'መለለዪ ኣገልግሎት ተመዝጊቡ። ዋጋ ምስጢር ኣይተዓቀበን።',
    so: 'Aqoonsiga adeegga waa la diiwaangeliyey. Wax qiime sir ah lama kaydin.',
    ar: 'تم تسجيل هوية الخدمة. لم تُخزّن أي قيمة سرية.',
    sw: 'Utambulisho wa huduma umerekodiwa. Hakuna thamani ya siri iliyohifadhiwa.',
  },
  'Rotation evidence recorded. The external secret manager remains authoritative for the credential.': {
    am: 'የማዞሪያ ማስረጃ ተመዝግቧል። ለማረጋገጫው ዋና ሥልጣን ያለው ውጫዊ የሚስጥር አስተዳዳሪ ነው።',
    om: 'Ragaan marsaa jijjiiruu galmaaʼeera. Bulchaan iccitii alaa ragaa seensaa kanaaf madda aangoo taʼee hafa.',
    ti: 'መርትዖ ምቕያር ምስጢር ተመዝጊቡ። ንመለለዪ መእተዊ ስልጣን ዘለዎ ናይ ደገ ምምሕዳር ምስጢር እዩ።',
    so: 'Caddaynta wareejinta sirta waa la diiwaangeliyey. Maamulaha siraha dibadda ayaa weli ah isha rasmiga ah ee aqoonsiga.',
    ar: 'تم تسجيل دليل تدوير بيانات الاعتماد. يظل مدير الأسرار الخارجي هو المرجع المعتمد لبيانات الاعتماد.',
    sw: 'Ushahidi wa kubadilisha siri umerekodiwa. Kidhibiti siri cha nje kinaendelea kuwa chanzo rasmi cha kitambulisho.',
  },
  'Operational readiness evidence recorded in the shared database. This is evidence only and does not grant approval.': {
    am: 'የአሠራር ዝግጁነት ማስረጃ በተጋራው የውሂብ ጎታ ተመዝግቧል። ይህ ማስረጃ ብቻ ነው፤ ፈቃድ አይሰጥም።',
    om: 'Ragaan qophii hojii kuusdeetaa qoodame keessatti galmaaʼeera. Kun ragaa qofa; hayyama hin kennu.',
    ti: 'መርትዖ ድልውነት ስራሕ ኣብ ዝተኻፈለ ዳታቤዝ ተመዝጊቡ። እዚ መርትዖ ጥራይ እዩ፣ ፍቓድ ኣይህብን።',
    so: 'Caddaynta u-diyaargarowga hawlgalka waxaa lagu diiwaangeliyey xogta la wadaago. Tani waa caddayn keliya mana bixiso oggolaansho.',
    ar: 'سُجّل دليل الجاهزية التشغيلية في قاعدة البيانات المشتركة. هذا دليل فقط ولا يمنح موافقة.',
    sw: 'Ushahidi wa utayari wa uendeshaji umerekodiwa kwenye hifadhidata ya pamoja. Huu ni ushahidi tu na hautoi idhini.',
  },
  'Your Insurance information request was submitted. It is not an application or policy.': {
    am: 'የኢንሹራንስ መረጃ ጥያቄዎ ቀርቧል። ይህ ማመልከቻ ወይም ፖሊሲ አይደለም።',
    om: 'Gaaffiin odeeffannoo inshuraansii keessanii dhiyaateera. Kun iyyata yookaan poolisii miti.',
    ti: 'ሕቶ ሓበሬታ ውሕስነትኩም ቀሪቡ። እዚ መመልከቲ ወይ ፖሊሲ ኣይኮነን።',
    so: 'Codsigaaga macluumaadka caymiska waa la gudbiyey. Ma aha codsi caymis ama caymis la soo saaray.',
    ar: 'تم إرسال طلب معلومات التأمين. وهو ليس طلب تأمين أو وثيقة.',
    sw: 'Ombi lako la maelezo ya bima limewasilishwa. Hili si ombi la bima wala sera.',
  },
  'Synthetic Insurance brokerage training case created; no live business activity occurred.': {
    am: 'ሰው ሠራሽ የኢንሹራንስ ደላላ ሥልጠና ጉዳይ ተፈጥሯል፤ እውነተኛ የንግድ እንቅስቃሴ አልተከናወነም።',
    om: 'Dhimmichi leenjii daldala inshuraansii nam-tolchee uumameera; hojii daldalaa dhugaa hin raawwatamne.',
    ti: 'ጉዳይ ስልጠና ደላላ ውሕስነት ሰብ ሰራሕ ተፈጢሩ፤ ናይ ሓቂ ንግዳዊ ንጥፈት ኣይተኻየደን።',
    so: 'Kiiska tababarka dilaalka caymiska ee macmalka ah waa la sameeyey; wax ganacsi toos ah ma dhicin.',
    ar: 'أُنشئت حالة تدريب اصطناعية لوساطة التأمين؛ ولم يحدث أي نشاط تجاري فعلي.',
    sw: 'Kesi ya mafunzo ya udalali wa bima ya kubuni imeundwa; hakuna shughuli halisi ya biashara iliyofanyika.',
  },
  'Tenant registered.': {
    am: 'ተከራዩ ተመዝግቧል።', om: 'Tenant galmaaʼeera.', ti: 'ተናንት ተመዝጊቡ።', so: 'Kiraystaha waa la diiwaangeliyey.', ar: 'تم تسجيل المستأجر.', sw: 'Mpangaji amesajiliwa.',
  },
  'Lease draft created. Submit it for independent approval before collecting signatures or activating the unit.': {
    am: 'የኪራይ ውል ረቂቅ ተፈጥሯል። ፊርማ ከመሰብሰብ ወይም ክፍሉን ከማንቃት በፊት ለገለልተኛ ፈቃድ ያቅርቡ።',
    om: 'Waliigalteen kiraa wixinee uumameera. Mallattoo walitti qabuu yookaan kutaa hojii irra oolchuu dura raggaasisa of dandaʼeef dhiyeessaa.',
    ti: 'ረቂቕ ውዕል ክራይ ተፈጢሩ። ፊርማ ቅድሚ ምእካብ ወይ ክፍሊ ቅድሚ ምንቃሕ ንናጻ ምጽዳቕ ኣቕርብዎ።',
    so: 'Qabyo-qoraalka heshiiska kirada waa la sameeyey. U gudbi ansixin madax-bannaan ka hor ururinta saxiixyada ama hawlgelinta qaybta.',
    ar: 'أُنشئت مسودة عقد الإيجار. أرسلها للموافقة المستقلة قبل جمع التوقيعات أو تفعيل الوحدة.',
    sw: 'Rasimu ya mkataba wa upangishaji imeundwa. Iwasilishe kwa idhini huru kabla ya kukusanya saini au kuwasha nyumba.',
  },
  'Signature evidence uploaded. The file does not verify signer identity or legal validity.': {
    am: 'የፊርማ ማስረጃ ተጭኗል። ፋይሉ የፈራሚውን ማንነት ወይም ሕጋዊነት አያረጋግጥም።',
    om: 'Ragaan mallattoo feʼameera. Faayilli eenyummaa mallatteessaa yookaan seera-qabeessummaa hin mirkaneessu.',
    ti: 'መርትዖ ፊርማ ተጽዒኑ። እቲ ፋይል መንነት ፈራሚ ወይ ሕጋውነት ኣየረጋግጽን።',
    so: 'Caddaynta saxiixa waa la geliyey. Faylku ma xaqiijinayo aqoonsiga saxiixaha ama ansaxnimada sharciga.',
    ar: 'تم رفع دليل التوقيع. لا يثبت الملف هوية الموقّع أو الصلاحية القانونية.',
    sw: 'Ushahidi wa saini umepakiwa. Faili hii haithibitishi utambulisho wa aliyetia saini wala uhalali wa kisheria.',
  },
  'Operational notice record saved. This does not terminate the lease or establish legal validity.': {
    am: 'የአሠራር ማሳወቂያ መዝገብ ተቀምጧል። ይህ ኪራዩን አያቋርጥም ወይም ሕጋዊነትን አያረጋግጥም።',
    om: 'Galmeen beeksisa hojii olkaaʼameera. Kun kiraa hin xumuru yookaan seera-qabeessummaa hin mirkaneessu.',
    ti: 'መዝገብ ምልክታ ስራሕ ተዓቂቡ። እዚ ክራይ ኣየቋርጽን ወይ ሕጋውነት ኣየረጋግጽን።',
    so: 'Diiwaanka ogeysiiska hawlgalka waa la kaydiyey. Tani ma joojinayso heshiiska kirada mana xaqiijinayso ansax sharci.',
    ar: 'تم حفظ سجل الإشعار التشغيلي. لا ينهي ذلك عقد الإيجار ولا يثبت صحته القانونية.',
    sw: 'Rekodi ya taarifa ya uendeshaji imehifadhiwa. Hii haikatishi upangishaji wala kuthibitisha uhalali wa kisheria.',
  },
  'Contract created.': {
    am: 'ውሉ ተፈጥሯል።', om: 'Waliigalteen uumameera.', ti: 'ውዕል ተፈጢሩ።', so: 'Heshiiska waa la sameeyey.', ar: 'تم إنشاء العقد.', sw: 'Mkataba umeundwa.',
  },
  'Updated property listing submitted for independent review.': {
    am: 'የተዘመነው የንብረት ማስታወቂያ ለገለልተኛ ግምገማ ቀርቧል።',
    om: 'Tarreen qabeenyaa haaromfame gamaaggama of dandaʼeef dhiyaateera.',
    ti: 'ዝተሓደሰ ዝርዝር ንብረት ንናጻ ግምገማ ቀሪቡ።',
    so: 'Liiska hantida ee la cusboonaysiiyey waxaa loo gudbiyey dib-u-eegis madax-bannaan.',
    ar: 'أُرسلت قائمة العقار المحدّثة للمراجعة المستقلة.',
    sw: 'Tangazo la mali lililosasishwa limewasilishwa kwa ukaguzi huru.',
  },
  'Lead reassigned and new ownership protection started.': {
    am: 'ደንበኛው ዳግም ተመድቧል፤ አዲስ የባለቤትነት ጥበቃም ተጀምሯል።',
    om: 'Maamilaan irra deebiʼamee ramadameera; eegumsi abbummaa haaraan jalqabameera.',
    ti: 'ዓሚል ዳግም ተመዲቡ፣ ሓድሽ ሓለዋ ዋንነት ድማ ተጀሚሩ።',
    so: 'Macmiilka dib ayaa loo qoondeeyey, ilaalin lahaansho cusubna waa la bilaabay.',
    ar: 'أُعيد تعيين العميل المحتمل وبدأت حماية ملكية جديدة.',
    sw: 'Mteja tarajiwa amepangiwa upya na ulinzi mpya wa umiliki umeanza.',
  },
  'Global Admin promotion request submitted for independent review.': {
    am: 'የግሎባል አስተዳዳሪ ደረጃ ጥያቄ ለገለልተኛ ግምገማ ቀርቧል።',
    om: 'Gaaffiin ol-kaʼiinsa Admin Addunyaa gamaaggama of dandaʼeef dhiyaateera.',
    ti: 'ሕቶ ዕብየት Global Admin ንናጻ ግምገማ ቀሪቡ።',
    so: 'Codsiga dallacaadda Global Admin waxaa loo gudbiyey dib-u-eegis madax-bannaan.',
    ar: 'أُرسل طلب ترقية المسؤول العام للمراجعة المستقلة.',
    sw: 'Ombi la kupandishwa cheo kuwa Global Admin limewasilishwa kwa ukaguzi huru.',
  },
  'Choose a worker arrangement': {
    am: 'የሠራተኛ የሥራ ዝግጅት ይምረጡ', om: 'Qindaaʼina hojjetaa filadhaa', ti: 'ውድብ ስራሕ ሰራሕተኛ ምረጹ', so: 'Dooro habka shaqaalaynta', ar: 'اختر ترتيب العمل للعامل', sw: 'Chagua mpangilio wa kazi wa mfanyakazi',
  },
  'Property details are unavailable. Refresh and try again.': {
    am: 'የንብረት ዝርዝሮች አይገኙም። ያድሱና እንደገና ይሞክሩ።',
    om: 'Balʼinni qabeenyaa hin jiru. Haaromsaa irra deebiʼaa yaalaa.',
    ti: 'ዝርዝር ንብረት ኣይርከብን። ኣሐድሱን ደጊምኩም ፈትኑን።',
    so: 'Faahfaahinta hantidu lama heli karo. Dib u cusboonaysii oo mar kale isku day.',
    ar: 'تفاصيل العقار غير متاحة. حدّث الصفحة وحاول مرة أخرى.',
    sw: 'Maelezo ya mali hayapatikani. Onyesha upya na ujaribu tena.',
  },
  'Add a unit': {
    am: 'ክፍል ይጨምሩ', om: 'Kutaa dabalaa', ti: 'ክፍሊ ወስኹ', so: 'Ku dar qayb', ar: 'أضف وحدة', sw: 'Ongeza nyumba',
  },
  'Explain why you need temporary access to this case (at least 10 characters).': {
    am: 'ለዚህ ጉዳይ ጊዜያዊ መዳረሻ ለምን እንደሚያስፈልግዎ ያብራሩ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Dhimma kanaaf seensa yeroo gabaabaa maaliif akka barbaaddan ibsaa (qubee yoo xiqqaate 10).',
    ti: 'ንእዚ ጉዳይ ግዝያዊ መእተዊ ስለምንታይ ከምዘድልየኩም ግለጹ (እንተወሓደ 10 ፊደላት)።',
    so: 'Sharax sababta aad ugu baahan tahay gelitaan ku-meel-gaar ah oo kiiskan ah (ugu yaraan 10 xaraf).',
    ar: 'اشرح سبب حاجتك إلى وصول مؤقت لهذه الحالة (10 أحرف على الأقل).',
    sw: 'Eleza kwa nini unahitaji ufikiaji wa muda wa kesi hii (angalau herufi 10).',
  },
  'Sensitive access request submitted for independent approval.': {
    am: 'የስሱ መረጃ መዳረሻ ጥያቄ ለገለልተኛ ፈቃድ ቀርቧል።',
    om: 'Gaaffiin seensa odeeffannoo miira-qabeessaa raggaasisa of dandaʼeef dhiyaateera.',
    ti: 'ሕቶ መእተዊ ስሱ ሓበሬታ ንናጻ ምጽዳቕ ቀሪቡ።',
    so: 'Codsiga gelitaanka xogta xasaasiga ah waxaa loo gudbiyey ansixin madax-bannaan.',
    ar: 'أُرسل طلب الوصول إلى البيانات الحساسة للموافقة المستقلة.',
    sw: 'Ombi la ufikiaji wa taarifa nyeti limewasilishwa kwa idhini huru.',
  },
  'Record the approval or denial reason (at least 10 characters).': {
    am: 'የፈቃድ ወይም የእምቢታ ምክንያት ይመዝግቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Sababa raggaasuu yookaan diduu galmeessaa (qubee yoo xiqqaate 10).',
    ti: 'ምኽንያት ምጽዳቕ ወይ ምንጻግ መዝግቡ (እንተወሓደ 10 ፊደላት)።',
    so: 'Diiwaangeli sababta oggolaanshaha ama diidmada (ugu yaraan 10 xaraf).',
    ar: 'سجّل سبب الموافقة أو الرفض (10 أحرف على الأقل).',
    sw: 'Rekodi sababu ya kuidhinisha au kukataa (angalau herufi 10).',
  },
  'Record why this support case status is changing (at least 10 characters).': {
    am: 'የዚህ የድጋፍ ጉዳይ ሁኔታ ለምን እንደሚቀየር ይመዝግቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Haalli dhimma deeggarsaa kanaa maaliif akka jijjiiramu galmeessaa (qubee yoo xiqqaate 10).',
    ti: 'Kuntaa እዚ ጉዳይ ደገፍ ስለምንታይ ከምዝቕየር መዝግቡ (እንተወሓደ 10 ፊደላት)።',
    so: 'Diiwaangeli sababta xaaladda kiiskan taageero loo beddelayo (ugu yaraan 10 xaraf).',
    ar: 'سجّل سبب تغيير حالة طلب الدعم هذا (10 أحرف على الأقل).',
    sw: 'Rekodi kwa nini hali ya kesi hii ya usaidizi inabadilishwa (angalau herufi 10).',
  },
  'Support case status updated and the user was notified.': {
    am: 'የድጋፍ ጉዳዩ ሁኔታ ተዘምኗል፤ ተጠቃሚውም ተነግሮታል።',
    om: 'Haalli dhimma deeggarsaa haaromfameera; fayyadamaanis beeksifameera.',
    ti: 'ኩነታት ጉዳይ ደገፍ ተሓዲሱ፣ ተጠቃሚ ድማ ተሓቢሩ።',
    so: 'Xaaladda kiiska taageerada waa la cusboonaysiiyey, isticmaalahana waa la ogeysiiyey.',
    ar: 'تم تحديث حالة طلب الدعم وإخطار المستخدم.',
    sw: 'Hali ya kesi ya usaidizi imesasishwa na mtumiaji amearifiwa.',
  },
  'Explain why you are appealing this resolution (at least 10 characters).': {
    am: 'ይህን መፍትሄ ለምን ይግባኝ እንደሚጠይቁ ያብራሩ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Furmaata kana irratti maaliif olmaa akka dhiyeessitan ibsaa (qubee yoo xiqqaate 10).',
    ti: 'ኣንጻር እዚ ፍታሕ ስለምንታይ ይግባይ ከምትቐርቡ ግለጹ (እንተወሓደ 10 ፊደላት)።',
    so: 'Sharax sababta aad racfaan uga qaadanayso xalkan (ugu yaraan 10 xaraf).',
    ar: 'اشرح سبب استئنافك لهذا الحل (10 أحرف على الأقل).',
    sw: 'Eleza kwa nini unakata rufaa dhidi ya utatuzi huu (angalau herufi 10).',
  },
  'Your appeal has been recorded.': {
    am: 'ይግባኝዎ ተመዝግቧል።', om: 'Olmaan keessan galmaaʼeera.', ti: 'ይግባይኩም ተመዝጊቡ።', so: 'Racfaanaga waa la diiwaangeliyey.', ar: 'تم تسجيل استئنافك.', sw: 'Rufaa yako imerekodiwa.',
  },
  'Enter a short reason for your response (at least 10 characters).': {
    am: 'ለምላሽዎ አጭር ምክንያት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Deebii keessaniif sababa gabaabaa galchaa (qubee yoo xiqqaate 10).',
    ti: 'ንመልስኹም ሓጺር ምኽንያት ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Geli sabab kooban oo jawaabtaada ah (ugu yaraan 10 xaraf).',
    ar: 'أدخل سببًا موجزًا لردك (10 أحرف على الأقل).',
    sw: 'Weka sababu fupi ya jibu lako (angalau herufi 10).',
  },
  'Leave or availability request withdrawn.': {
    am: 'የፈቃድ ወይም የመገኘት ጥያቄ ተነስቷል።', om: 'Gaaffiin boqonnaa yookaan argamaa haqameera.', ti: 'ሕቶ ዕረፍቲ ወይ ተረኽቦ ተሳሒቡ።', so: 'Codsiga fasaxa ama helitaanka waa laga noqday.', ar: 'تم سحب طلب الإجازة أو التوفر.', sw: 'Ombi la likizo au upatikanaji limeondolewa.',
  },
  'Enter why this shift is being cancelled (at least 10 characters).': {
    am: 'ይህ ፈረቃ ለምን እንደሚሰረዝ ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Jijjiirraan hojii kun maaliif akka haqamu galchaa (qubee yoo xiqqaate 10).',
    ti: 'እዚ ሽፍት ስለምንታይ ከምዝስረዝ ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Geli sababta wareeggan loo baajinayo (ugu yaraan 10 xaraf).',
    ar: 'أدخل سبب إلغاء هذه النوبة (10 أحرف على الأقل).',
    sw: 'Weka sababu ya kughairi zamu hii (angalau herufi 10).',
  },
  'Shift cancelled.': {
    am: 'ፈረቃው ተሰርዟል።', om: 'Jijjiirraan hojii haqameera.', ti: 'ሽፍት ተሰሪዙ።', so: 'Wareegga waa la baajiyey.', ar: 'تم إلغاء النوبة.', sw: 'Zamu imeghairiwa.',
  },
  'Handoff history': {
    am: 'የማስተላለፍ ታሪክ', om: 'Seenaa dabarsuu', ti: 'ታሪኽ ምርኽኻብ', so: 'Taariikhda wareejinta', ar: 'سجل التسليم', sw: 'Historia ya makabidhiano',
  },
  'Enter handed_off or handoff_failed. This records handoff status only.': {
    am: 'handed_off ወይም handoff_failed ያስገቡ። ይህ የማስተላለፍ ሁኔታን ብቻ ይመዘግባል።',
    om: 'handed_off yookaan handoff_failed galchaa. Kun haala dabarsuu qofa galmeessa.',
    ti: 'handed_off ወይ handoff_failed ኣእትዉ። እዚ ኩነታት ምርኽኻብ ጥራይ ይምዝግብ።',
    so: 'Geli handed_off ama handoff_failed. Tani waxay diiwaangelinaysaa xaaladda wareejinta oo keliya.',
    ar: 'أدخل handed_off أو handoff_failed. يسجّل ذلك حالة التسليم فقط.',
    sw: 'Weka handed_off au handoff_failed. Hii hurekodi hali ya makabidhiano pekee.',
  },
  'Enter the external status or failure details (at least 10 characters).': {
    am: 'ውጫዊ ሁኔታውን ወይም የአለመሳካቱን ዝርዝር ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Haala alaa yookaan balʼina kufaatii galchaa (qubee yoo xiqqaate 10).',
    ti: 'ኩነታት ደገ ወይ ዝርዝር ፍሽለት ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Geli xaaladda dibadda ama faahfaahinta fashilka (ugu yaraan 10 xaraf).',
    ar: 'أدخل الحالة الخارجية أو تفاصيل الإخفاق (10 أحرف على الأقل).',
    sw: 'Weka hali ya nje au maelezo ya hitilafu (angalau herufi 10).',
  },
  'Enter the external payroll provider handoff reference (at least 3 characters).': {
    am: 'የውጫዊ የደመወዝ አቅራቢ ማስተላለፊያ ማጣቀሻ ያስገቡ (ቢያንስ 3 ቁምፊዎች)።',
    om: 'Wabii dabarsaa dhiyeessaa kaffaltii mindaa alaa galchaa (qubee yoo xiqqaate 3).',
    ti: 'መወከሲ ምርኽኻብ ኣቕራቢ ደሞዝ ደገ ኣእትዉ (እንተወሓደ 3 ፊደላት)።',
    so: 'Geli tixraaca wareejinta bixiyaha mushaharka dibadda (ugu yaraan 3 xaraf).',
    ar: 'أدخل مرجع التسليم إلى مزوّد الرواتب الخارجي (3 أحرف على الأقل).',
    sw: 'Weka rejeleo la makabidhiano kwa mtoa huduma wa mishahara wa nje (angalau herufi 3).',
  },
  'Payroll export handoff status recorded. This does not confirm filing or payment.': {
    am: 'የደመወዝ ማውጫ ማስተላለፍ ሁኔታ ተመዝግቧል። ይህ ማቅረቡን ወይም ክፍያውን አያረጋግጥም።',
    om: 'Haalli dabarsuu baafata kaffaltii mindaa galmaaʼeera. Kun galchuu yookaan kaffaluu hin mirkaneessu.',
    ti: 'ኩነታት ምርኽኻብ ምውጻእ ደሞዝ ተመዝጊቡ። ምቕራብ ወይ ክፍሊት ኣየረጋግጽን።',
    so: 'Xaaladda wareejinta faylka mushaharka waa la diiwaangeliyey. Tani ma xaqiijinayso gudbin ama lacag-bixin.',
    ar: 'تم تسجيل حالة تسليم ملف الرواتب. ولا يؤكد ذلك تقديم الإقرار أو الدفع.',
    sw: 'Hali ya makabidhiano ya faili ya mishahara imerekodiwa. Hii haithibitishi uwasilishaji wala malipo.',
  },
  'Offboard this worker, close active engagements, cancel eligible future shifts and revoke worker sessions?': {
    am: 'ይህን ሠራተኛ ከሥራ ያስወግዱ፣ ንቁ የሥራ ተሳትፎዎችን ይዝጉ፣ ሊሰረዙ የሚችሉ የወደፊት ፈረቃዎችን ይሰርዙና የሠራተኛ ክፍለ ጊዜዎችን ይሻሩ?',
    om: 'Hojjetaa kana hojii irraa baasuu, hojiiwwan gaggeeffamaa jiran cufuu, jijjiirraa hojii fuulduraa haqamuu dandaʼan haquu fi seensa hojjetaa haquu barbaadduu?',
    ti: 'ነዚ ሰራሕተኛ ካብ ስራሕ ኣውጽኡ፣ ንጡፋት ስምምዓት ዕጸዉ፣ ዝስረዙ መጻኢ ሽፍትታት ሰርዙን ክፍለ ግዜ ሰራሕተኛ ስርዙን?',
    so: 'Ma shaqada ma ka joojinaysaa shaqaalahan, xiraysaa hawlaha socda, baajinaysaa wareegyada mustaqbalka ee la baajin karo, kana joojinaysaa kulammada shaqaalaha?',
    ar: 'هل تريد إنهاء عمل هذا العامل وإغلاق الارتباطات النشطة وإلغاء النوبات المستقبلية القابلة للإلغاء وإنهاء جلساته؟',
    sw: 'Je, unataka kumwondoa mfanyakazi huyu, kufunga ushiriki unaoendelea, kughairi zamu za baadaye zinazoweza kughairiwa na kubatilisha vipindi vyake?',
  },
  'Enter the offboarding reason (at least 10 characters).': {
    am: 'ከሥራ የሚያስወግዱበትን ምክንያት ያስገቡ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Sababa hojii irraa baasuu galchaa (qubee yoo xiqqaate 10).',
    ti: 'ምኽንያት ምውጻእ ካብ ስራሕ ኣእትዉ (እንተወሓደ 10 ፊደላት)።',
    so: 'Geli sababta shaqada looga joojinayo (ugu yaraan 10 xaraf).',
    ar: 'أدخل سبب إنهاء العمل (10 أحرف على الأقل).',
    sw: 'Weka sababu ya kumwondoa kazini (angalau herufi 10).',
  },
  'Worker offboarded and active sessions revoked.': {
    am: 'ሠራተኛው ከሥራ ተወግዷል፤ ንቁ ክፍለ ጊዜዎችም ተሽረዋል።',
    om: 'Hojjetaan hojii irraa baafameera; seensonni hojii irra jiran haqamaniiru.',
    ti: 'ሰራሕተኛ ካብ ስራሕ ወጺኡ፣ ንጡፋት ክፍለ ግዜታት ድማ ተሰሪዞም።',
    so: 'Shaqaalaha shaqada waa laga joojiyey, kulammadii firfircoonaana waa la buriyey.',
    ar: 'تم إنهاء عمل العامل وإبطال الجلسات النشطة.',
    sw: 'Mfanyakazi ameondolewa kazini na vipindi vinavyotumika vimebatilishwa.',
  },
  'Tenant Super Admin assignment removed.': {
    am: 'የተከራይ ሱፐር አስተዳዳሪ ምደባ ተወግዷል።', om: 'Ramaddiin Super Admin tenant irraa haqameera.', ti: 'ምደባ Super Admin ተናንት ተኣልዩ።', so: 'Meelaynta Super Admin ee kiraystaha waa laga saaray.', ar: 'تمت إزالة تعيين المسؤول الفائق للمستأجر.', sw: 'Ugawaji wa Super Admin wa mpangaji umeondolewa.',
  },
  'Inventory marked retired. Revoke the credential in the external secret manager separately.': {
    am: 'የንብረት መዝገቡ ከአገልግሎት ውጭ ተብሎ ተመዝግቧል። ማረጋገጫውን በውጫዊው የሚስጥር አስተዳዳሪ ውስጥ በተለይ ይሽሩ።',
    om: 'Meeshaan keessaa hojii irra hin oolle jedhamee mallatteeffameera. Ragaa seensaa bulchaa iccitii alaa keessatti adda baasuun haquu.',
    ti: 'እቲ ዝርዝር ካብ ኣገልግሎት ወጻኢ ተባሂሉ ተምልኪቱ። መለለዪ መእተዊ ኣብ ናይ ደገ ምምሕዳር ምስጢር ብተፈላለየ ስርዙ።',
    so: 'Alaabta waxaa loo calaamadeeyey mid hawlgab ah. Aqoonsiga ka jooji maamulaha siraha dibadda si gooni ah.',
    ar: 'تم تعليم العنصر بأنه متقاعد. ألغِ بيانات الاعتماد بشكل منفصل في مدير الأسرار الخارجي.',
    sw: 'Kipengee kimewekewa alama ya kustaafishwa. Batilisha kitambulisho kando kwenye kidhibiti siri cha nje.',
  },
  'Training content archived.': {
    am: 'የሥልጠና ይዘቱ ወደ ማህደር ገብቷል።', om: 'Qabiyyeen leenjii kuusaa keessatti kaaʼameera.', ti: 'ትሕዝቶ ስልጠና ኣብ ማህደር ተቐሚጡ።', so: 'Nuxurka tababarka waa la kaydiyey.', ar: 'تمت أرشفة محتوى التدريب.', sw: 'Maudhui ya mafunzo yamewekwa kwenye kumbukumbu.',
  },
  'Choose a signed contract document first.': {
    am: 'መጀመሪያ የተፈረመ የውል ሰነድ ይምረጡ።', om: 'Jalqaba sanada waliigaltee mallattaaʼe filadhaa.', ti: 'መጀመርታ ሰነድ ውዕል ዝተፈረመ ምረጹ።', so: 'Marka hore dooro dukumenti heshiis oo saxiixan.', ar: 'اختر أولًا مستند عقد موقّعًا.', sw: 'Chagua kwanza hati ya mkataba iliyotiwa saini.',
  },
  'The contract document must be 10 MB or smaller.': {
    am: 'የውል ሰነዱ 10 MB ወይም ከዚያ በታች መሆን አለበት።', om: 'Sanadni waliigaltee 10 MB yookaan isaa gadi taʼuu qaba.', ti: 'ሰነድ ውዕል 10 MB ወይ ካብኡ ንታሕቲ ክኸውን ኣለዎ።', so: 'Dukumentiga heshiisku waa inuu ahaadaa 10 MB ama ka yar.', ar: 'يجب ألا يتجاوز حجم مستند العقد 10 ميغابايت.', sw: 'Hati ya mkataba lazima iwe MB 10 au chini.',
  },
  'Listing submitted. It will appear to buyers after any required review.': {
    am: 'ማስታወቂያው ቀርቧል። የሚፈለግ ግምገማ ከተጠናቀቀ በኋላ ለገዢዎች ይታያል።',
    om: 'Tarreen dhiyaateera. Gamaaggamni barbaachisu erga xumuramee booda bittootaaf mulʼata.',
    ti: 'ዝርዝር ቀሪቡ። ዝድለ ግምገማ ምስተዛዘመ ንገዛእቲ ክረአ እዩ።',
    so: 'Liiska waa la gudbiyey. Iibsadayaashu way arki doonaan marka dib-u-eegista loo baahan yahay la dhammeeyo.',
    ar: 'تم إرسال القائمة. ستظهر للمشترين بعد إتمام أي مراجعة مطلوبة.',
    sw: 'Tangazo limewasilishwa. Wanunuzi wataliona baada ya ukaguzi unaohitajika kukamilika.',
  },
  'Listing submitted for publication review.': {
    am: 'ማስታወቂያው ለህትመት ግምገማ ቀርቧል።', om: 'Tarreen maxxansaaf gamaaggamaaf dhiyaateera.', ti: 'ዝርዝር ንግምገማ ሕትመት ቀሪቡ።', so: 'Liiska waxaa loo gudbiyey dib-u-eegista daabacaadda.', ar: 'أُرسلت القائمة لمراجعة النشر.', sw: 'Tangazo limewasilishwa kwa ukaguzi wa uchapishaji.',
  },
  'Marketplace configuration saved.': {
    am: 'የገበያ ቦታ ውቅር ተቀምጧል።', om: 'Qindaaʼinni bakka gabaa olkaaʼameera.', ti: 'ምቅናዕ ቦታ ዕዳጋ ተዓቂቡ።', so: 'Dejinta suuqa waa la kaydiyey.', ar: 'تم حفظ إعدادات السوق.', sw: 'Mipangilio ya soko imehifadhiwa.',
  },
  'Agent service assignment updated.': {
    am: 'የወኪሉ የአገልግሎት ምደባ ተዘምኗል።', om: 'Ramaddiin tajaajilaa bakka buʼaa haaromfameera.', ti: 'ምደባ ኣገልግሎት ወኪል ተሓዲሱ።', so: 'Meelaynta adeegga wakiilka waa la cusboonaysiiyey.', ar: 'تم تحديث تعيين خدمة الوكيل.', sw: 'Ugawaji wa huduma ya wakala umesasishwa.',
  },
  'Contract workflow updated.': {
    am: 'የውል ሂደቱ ተዘምኗል።', om: 'Adeemsi waliigaltee haaromfameera.', ti: 'መስርሕ ውዕል ተሓዲሱ።', so: 'Habka heshiiska waa la cusboonaysiiyey.', ar: 'تم تحديث سير عمل العقد.', sw: 'Mtiririko wa mkataba umesasishwa.',
  },
  'Rent transaction reconciled and posted to the ledger.': {
    am: 'የኪራይ ግብይቱ ተዛምዶ ወደ ሒሳብ መዝገብ ተለጥፏል።',
    om: 'Daldalli kiraa wal-simsiifamee galmee herrega keessatti maxxanfameera.',
    ti: 'ግብይት ክራይ ተሰማሚዑ ኣብ መዝገብ ሒሳብ ተመዝጊቡ።',
    so: 'Macaamilka kirada waa la heshiisiiyey oo buugga xisaabta ayaa lagu qoray.',
    ar: 'تمت تسوية معاملة الإيجار وترحيلها إلى دفتر الحسابات.',
    sw: 'Muamala wa kodi umelinganishwa na kurekodiwa kwenye leja.',
  },
  'Pending rent transaction voided.': {
    am: 'በመጠባበቅ ላይ ያለው የኪራይ ግብይት ተሰርዟል።', om: 'Daldalli kiraa eegachaa ture haqameera.', ti: 'ግብይት ክራይ ኣብ ትጽቢት ዝነበረ ተሰሪዙ።', so: 'Macaamilkii kirada ee sugayey waa la buriyey.', ar: 'تم إلغاء معاملة الإيجار المعلّقة.', sw: 'Muamala wa kodi uliokuwa unasubiri umebatilishwa.',
  },
  'Lease activated and rent schedule created. Uploaded signature files are retained as evidence only.': {
    am: 'ኪራዩ ነቅቷል፤ የኪራይ መርሐ ግብርም ተፈጥሯል። የተጫኑ የፊርማ ፋይሎች እንደ ማስረጃ ብቻ ይቀመጣሉ።',
    om: 'Kiraan hojii irra ooleera; sagantaan kaffaltii kiraas uumameera. Faayiloonni mallattoo feʼaman ragaa qofaaf kuufamu.',
    ti: 'ክራይ ነቒሑ፣ መደብ ክፍሊት ክራይ ድማ ተፈጢሩ። ዝተጸዓኑ ፋይላት ፊርማ ከም መርትዖ ጥራይ ይቕመጡ።',
    so: 'Kirada waa la hawlgeliyey, jadwalka kiradana waa la sameeyey. Faylasha saxiixa ee la geliyey caddayn ahaan oo keliya ayaa loo hayaa.',
    ar: 'تم تفعيل عقد الإيجار وإنشاء جدول الإيجار. تُحتفظ بملفات التوقيع المرفوعة كأدلة فقط.',
    sw: 'Upangishaji umewashwa na ratiba ya kodi imeundwa. Faili za saini zilizopakiwa zinahifadhiwa kama ushahidi pekee.',
  },
  'Lease ended.': {
    am: 'ኪራዩ ተጠናቋል።', om: 'Kiraan xumurameera.', ti: 'ክራይ ተዛዚሙ።', so: 'Kiradu way dhammaatay.', ar: 'انتهى عقد الإيجار.', sw: 'Upangishaji umeisha.',
  },
  'Deposit receipt recorded and awaiting independent reconciliation.': {
    am: 'የተቀማጭ ደረሰኝ ተመዝግቦ ገለልተኛ ማስታረቅን እየጠበቀ ነው።',
    om: 'Nagaheen wabii galmaaʼeera; wal-simsiisuu of dandaʼe eeggachaa jira.',
    ti: 'ደረሰኝ ተቐማጢ ተመዝጊቡ ናጻ ምስምማዕ ይጽበ ኣሎ።',
    so: 'Rasiidhka deebaajiga waa la diiwaangeliyey wuxuuna sugayaa heshiisiin madax-bannaan.',
    ar: 'تم تسجيل إيصال الوديعة وهو بانتظار التسوية المستقلة.',
    sw: 'Risiti ya amana imerekodiwa na inasubiri ulinganishaji huru.',
  },
  'Deposit return recorded and awaiting independent reconciliation.': {
    am: 'የተቀማጭ መመለስ ተመዝግቦ ገለልተኛ ማስታረቅን እየጠበቀ ነው።',
    om: 'Deebiin wabii galmaaʼeera; wal-simsiisuu of dandaʼe eeggachaa jira.',
    ti: 'ምምላስ ተቐማጢ ተመዝጊቡ ናጻ ምስምማዕ ይጽበ ኣሎ።',
    so: 'Soo-celinta deebaajiga waa la diiwaangeliyey waxayna sugaysaa heshiisiin madax-bannaan.',
    ar: 'تم تسجيل إعادة الوديعة وهي بانتظار التسوية المستقلة.',
    sw: 'Urejeshaji wa amana umerekodiwa na unasubiri ulinganishaji huru.',
  },
  'Rent payment recorded and awaiting independent reconciliation.': {
    am: 'የኪራይ ክፍያ ተመዝግቦ ገለልተኛ ማስታረቅን እየጠበቀ ነው።',
    om: 'Kaffaltiin kiraa galmaaʼeera; wal-simsiisuu of dandaʼe eeggachaa jira.',
    ti: 'ክፍሊት ክራይ ተመዝጊቡ ናጻ ምስምማዕ ይጽበ ኣሎ።',
    so: 'Lacag-bixinta kirada waa la diiwaangeliyey waxayna sugaysaa heshiisiin madax-bannaan.',
    ar: 'تم تسجيل دفعة الإيجار وهي بانتظار التسوية المستقلة.',
    sw: 'Malipo ya kodi yamerekodiwa na yanasubiri ulinganishaji huru.',
  },
  'Session ended.': {
    am: 'ክፍለ ጊዜው ተጠናቋል።', om: 'Yeroon seensaa xumurameera.', ti: 'ክፍለ ግዜ ተዛዚሙ።', so: 'Kulankii wuu dhammaaday.', ar: 'انتهت الجلسة.', sw: 'Kipindi kimeisha.',
  },
  'No active property vendors are available for assignment.': {
    am: 'ለምደባ የሚሆኑ ንቁ የንብረት አቅራቢዎች የሉም።',
    om: 'Dhiyeessitoonni qabeenyaa ramaduuf taʼan hojii irra jiran hin jiran.',
    ti: 'ንምምዳብ ዝኾኑ ንጡፋት ኣቕረብቲ ንብረት የለዉን።',
    so: 'Ma jiraan iibiyayaal hanti oo firfircoon oo loo qoondeyn karo.',
    ar: 'لا يتوفر مورّدو عقارات نشطون للتعيين.',
    sw: 'Hakuna wasambazaji wa mali wanaotumika wa kukabidhiwa.',
  },
  'Confirm you can take this work order and add a note.': {
    am: 'ይህን የሥራ ትዕዛዝ መቀበልዎን ያረጋግጡና ማስታወሻ ያክሉ።',
    om: 'Ajaja hojii kana fudhachuu keessan mirkaneessaa; yaadannoo dabalaa.',
    ti: 'ነዚ ትእዛዝ ስራሕ ክትቅበልዎ ምዃንኩም ኣረጋግጹን ማስታወሻ ወስኹን።',
    so: 'Xaqiiji inaad qaadan karto amarkan shaqo oo ku dar qoraal.',
    ar: 'أكّد قدرتك على استلام أمر العمل هذا وأضف ملاحظة.',
    sw: 'Thibitisha kuwa unaweza kupokea agizo hili la kazi na uongeze dokezo.',
  },
  'Add a progress note before starting the work.': {
    am: 'ሥራውን ከመጀመርዎ በፊት የሂደት ማስታወሻ ያክሉ።',
    om: 'Hojii jalqabuu dura yaadannoo adeemsa dabalaa.',
    ti: 'ስራሕ ቅድሚ ምጅማርኩም ማስታወሻ ምዕባለ ወስኹ።',
    so: 'Ku dar qoraal horumar ka hor intaadan shaqada bilaabin.',
    ar: 'أضف ملاحظة عن التقدم قبل بدء العمل.',
    sw: 'Ongeza dokezo la maendeleo kabla ya kuanza kazi.',
  },
  'Malware-scanned evidence uploaded.': {
    am: 'ተንኮል አዘል ሶፍትዌር የተመረመረበት ማስረጃ ተጭኗል።',
    om: 'Ragaan vaayirasii kompiitaraa irraa sakattaʼame feʼameera.',
    ti: 'መርትዖ ካብ ማልዌር ዝተመርመረ ተጽዒኑ።',
    so: 'Caddaynta laga baaray fayrasyada waa la geliyey.',
    ar: 'تم رفع الدليل بعد فحصه من البرمجيات الضارة.',
    sw: 'Ushahidi uliokaguliwa dhidi ya programu hasidi umepakiwa.',
  },
  'Work submitted for independent review.': {
    am: 'ሥራው ለገለልተኛ ግምገማ ቀርቧል።', om: 'Hojichi gamaaggama of dandaʼeef dhiyaateera.', ti: 'ስራሕ ንናጻ ግምገማ ቀሪቡ።', so: 'Shaqada waxaa loo gudbiyey dib-u-eegis madax-bannaan.', ar: 'أُرسل العمل للمراجعة المستقلة.', sw: 'Kazi imewasilishwa kwa ukaguzi huru.',
  },
  'Enter the additional cost requested in ETB.': {
    am: 'የተጠየቀውን ተጨማሪ ወጪ በETB ያስገቡ።', om: 'Baasii dabalataa gaafattan ETBn galchaa.', ti: 'ዝተሓተተ ወሰኽቲ ወጻኢ ብETB ኣእትዉ።', so: 'Geli kharashka dheeraadka ah ee la codsaday kuna qor ETB.', ar: 'أدخل التكلفة الإضافية المطلوبة بعملة ETB.', sw: 'Weka gharama ya ziada iliyoombwa kwa ETB.',
  },
  'Explain why the additional cost is required (at least 10 characters).': {
    am: 'ተጨማሪው ወጪ ለምን እንደሚያስፈልግ ያብራሩ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Baasii dabalataa maaliif akka barbaachisu ibsaa (qubee yoo xiqqaate 10).',
    ti: 'ወሰኽቲ ወጻኢ ስለምንታይ ከምዘድሊ ግለጹ (እንተወሓደ 10 ፊደላት)።',
    so: 'Sharax sababta kharashka dheeraadka ah loogu baahan yahay (ugu yaraan 10 xaraf).',
    ar: 'اشرح سبب الحاجة إلى التكلفة الإضافية (10 أحرف على الأقل).',
    sw: 'Eleza kwa nini gharama ya ziada inahitajika (angalau herufi 10).',
  },
  'Additional-cost request sent for separate approval.': {
    am: 'የተጨማሪ ወጪ ጥያቄ ለተለየ ፈቃድ ተልኳል።', om: 'Gaaffiin baasii dabalataa raggaasisa addaatiif ergameera.', ti: 'ሕቶ ወሰኽቲ ወጻኢ ንፍሉይ ምጽዳቕ ተላኢኹ።', so: 'Codsiga kharashka dheeraadka ah waxaa loo diray ansixin gaar ah.', ar: 'أُرسل طلب التكلفة الإضافية لموافقة منفصلة.', sw: 'Ombi la gharama ya ziada limetumwa kwa idhini tofauti.',
  },
  'Enter the vendor invoice reference.': {
    am: 'የአቅራቢውን የደረሰኝ ማጣቀሻ ያስገቡ።', om: 'Wabii nagahee dhiyeessaa galchaa.', ti: 'መወከሲ ደረሰኝ ኣቕራቢ ኣእትዉ።', so: 'Geli tixraaca qaansheegta iibiyaha.', ar: 'أدخل مرجع فاتورة المورّد.', sw: 'Weka rejeleo la ankara ya msambazaji.',
  },
  'Enter the invoice amount in ETB.': {
    am: 'የደረሰኙን መጠን በETB ያስገቡ።', om: 'Hamma nagahee ETBn galchaa.', ti: 'Hamma ደረሰኝ ብETB ኣእትዉ።', so: 'Geli qaddarka qaansheegta kuna qor ETB.', ar: 'أدخل مبلغ الفاتورة بعملة ETB.', sw: 'Weka kiasi cha ankara kwa ETB.',
  },
  'Enter the invoice date (YYYY-MM-DD).': {
    am: 'የደረሰኝ ቀን ያስገቡ (YYYY-MM-DD)።', om: 'Guyyaa nagahee galchaa (YYYY-MM-DD).', ti: 'ዕለት ደረሰኝ ኣእትዉ (YYYY-MM-DD)።', so: 'Geli taariikhda qaansheegta (YYYY-MM-DD).', ar: 'أدخل تاريخ الفاتورة (YYYY-MM-DD).', sw: 'Weka tarehe ya ankara (YYYY-MM-DD).',
  },
  'Enter the due date (YYYY-MM-DD).': {
    am: 'የክፍያ ቀነ ገደቡን ያስገቡ (YYYY-MM-DD)።', om: 'Guyyaa kaffaltii itti dhumu galchaa (YYYY-MM-DD).', ti: 'ዕለት መወዳእታ ክፍሊት ኣእትዉ (YYYY-MM-DD)።', so: 'Geli taariikhda kama dambaysta bixinta (YYYY-MM-DD).', ar: 'أدخل تاريخ الاستحقاق (YYYY-MM-DD).', sw: 'Weka tarehe ya mwisho wa malipo (YYYY-MM-DD).',
  },
  'No scanned evidence is available.': {
    am: 'የተቃኘ ማስረጃ አይገኝም።', om: 'Ragaan iskaan godhame hin jiru.', ti: 'መርትዖ ዝተስካነ ኣይርከብን።', so: 'Caddayn la sawiray lama hayo.', ar: 'لا يتوفر دليل ممسوح ضوئيًا.', sw: 'Hakuna ushahidi uliochanganuliwa.',
  },
  'Add triage notes (at least 5 characters).': {
    am: 'የመጀመሪያ ምደባ ማስታወሻዎችን ያክሉ (ቢያንስ 5 ቁምፊዎች)።',
    om: 'Yaadannoo ramaddii jalqabaa dabalaa (qubee yoo xiqqaate 5).',
    ti: 'ማስታወሻ መጀመርታ ምደባ ወስኹ (እንተወሓደ 5 ፊደላት)።',
    so: 'Ku dar qoraallada kala-soocidda hore (ugu yaraan 5 xaraf).',
    ar: 'أضف ملاحظات الفرز الأولي (5 أحرف على الأقل).',
    sw: 'Ongeza dokezo za uchunguzi wa awali (angalau herufi 5).',
  },
  'Set the SLA target in hours (1-720).': {
    am: 'የSLA ግቡን በሰዓት ያስገቡ (1-720)።', om: 'Kaayyoo SLA saʼaatiin galchaa (1-720).', ti: 'ዕላማ SLA ብሰዓት ኣቐምጡ (1-720)።', so: 'Deji bartilmaameedka SLA saacado ahaan (1-720).', ar: 'حدّد هدف SLA بالساعات (1-720).', sw: 'Weka lengo la SLA kwa saa (1-720).',
  },
  'Enter an SLA target between 1 and 720 hours.': {
    am: 'ከ1 እስከ 720 ሰዓት ያለ የSLA ግብ ያስገቡ።', om: 'Kaayyoo SLA saʼaatii 1 hanga 720 gidduu galchaa.', ti: 'ዕላማ SLA ካብ 1 ክሳብ 720 ሰዓት ኣእትዉ።', so: 'Geli bartilmaameed SLA oo u dhexeeya 1 iyo 720 saacadood.', ar: 'أدخل هدف SLA بين ساعة واحدة و720 ساعة.', sw: 'Weka lengo la SLA kati ya saa 1 na 720.',
  },
  'Enter a valid non-negative estimate.': {
    am: 'ትክክለኛ ዜሮ ወይም ከዜሮ በላይ የሆነ ግምት ያስገቡ።', om: 'Tilmaama sirrii zeeroo yookaan isaa ol taʼe galchaa.', ti: 'ግቡእ ዜሮ ወይ ካብ ዜሮ ዝዓቢ ግምት ኣእትዉ።', so: 'Geli qiyaas sax ah oo aan tabanayn.', ar: 'أدخل تقديرًا صالحًا غير سالب.', sw: 'Weka makadirio sahihi yasiyo hasi ya sifuri.',
  },
  'Maintenance request updated.': {
    am: 'የጥገና ጥያቄው ተዘምኗል።', om: 'Gaaffiin suphaa haaromfameera.', ti: 'ሕቶ ጽገና ተሓዲሱ።', so: 'Codsiga dayactirka waa la cusboonaysiiyey.', ar: 'تم تحديث طلب الصيانة.', sw: 'Ombi la matengenezo limesasishwa.',
  },
  'Your acceptance was recorded. The engagement is active when both parties accept.': {
    am: 'ተቀባይነትዎ ተመዝግቧል። ሁለቱም ወገኖች ሲቀበሉ የሥራ ተሳትፎው ንቁ ይሆናል።',
    om: 'Fudhatni keessan galmaaʼeera. Hirmaannaan hojii yeroo qaamoleen lamaan fudhatan hojii irra oola.',
    ti: 'ተቐባልነትኩም ተመዝጊቡ። ክልቲኦም ወገናት ምስ ተቐበሉ ስምምዕ ስራሕ ንጡፍ ይኸውን።',
    so: 'Oggolaanshahaaga waa la diiwaangeliyey. Hawshu waxay firfircoonaanaysaa marka labada dhinac oggolaadaan.',
    ar: 'تم تسجيل قبولك. يصبح الارتباط نشطًا عند موافقة الطرفين.',
    sw: 'Kukubali kwako kumerekodiwa. Ushirikiano huanza kutumika pande zote mbili zikikubali.',
  },
  'Enter the response for the worker (at least 5 characters).': {
    am: 'ለሠራተኛው የሚሰጠውን ምላሽ ያስገቡ (ቢያንስ 5 ቁምፊዎች)።',
    om: 'Deebii hojjetaa galchaa (qubee yoo xiqqaate 5).',
    ti: 'መልሲ ንሰራሕተኛ ኣእትዉ (እንተወሓደ 5 ፊደላት)።',
    so: 'Geli jawaabta shaqaalaha (ugu yaraan 5 xaraf).',
    ar: 'أدخل الرد للعامل (5 أحرف على الأقل).',
    sw: 'Weka jibu kwa mfanyakazi (angalau herufi 5).',
  },
  'Insurance information request updated.': {
    am: 'የኢንሹራንስ መረጃ ጥያቄው ተዘምኗል።', om: 'Gaaffiin odeeffannoo inshuraansii haaromfameera.', ti: 'ሕቶ ሓበሬታ ውሕስነት ተሓዲሱ።', so: 'Codsiga macluumaadka caymiska waa la cusboonaysiiyey.', ar: 'تم تحديث طلب معلومات التأمين.', sw: 'Ombi la maelezo ya bima limesasishwa.',
  },
  'Select an active Agent and assignment reason before assigning this referral.': {
    am: 'ይህን ሪፈራል ከመመደብዎ በፊት ንቁ ወኪልና የምደባ ምክንያት ይምረጡ።',
    om: 'Ergaa kana ramaduu dura bakka buʼaa hojii irra jiruufi sababa ramaddii filadhaa.',
    ti: 'ነዚ ምምራሕ ቅድሚ ምምዳብኩም ንጡፍ ወኪልን ምኽንያት ምደባን ምረጹ።',
    so: 'Dooro Wakiil firfircoon iyo sababta meelaynta ka hor intaadan gudbintan qoondeyn.',
    ar: 'اختر وكيلًا نشطًا وسبب التعيين قبل إسناد هذه الإحالة.',
    sw: 'Chagua Wakala anayetumika na sababu ya ugawaji kabla ya kukabidhi rufaa hii.',
  },
  'Consent-based Insurance referral assigned.': {
    am: 'በፈቃድ የተደረገው የኢንሹራንስ ሪፈራል ተመድቧል።',
    om: 'Ergaan inshuraansii hayyama irratti hundaaʼe ramadameera.',
    ti: 'ምምራሕ ውሕስነት ብፍቓድ ተመዲቡ።',
    so: 'Gudbinta caymiska ee oggolaanshaha ku salaysan waa la qoondeeyey.',
    ar: 'تم تعيين إحالة التأمين بموافقة العميل.',
    sw: 'Rufaa ya bima yenye ridhaa imekabidhiwa.',
  },
  'Insurance referral activity updated.': {
    am: 'የኢንሹራንስ ሪፈራል እንቅስቃሴ ተዘምኗል።', om: 'Sochiin ergaa inshuraansii haaromfameera.', ti: 'ንጥፈት ምምራሕ ውሕስነት ተሓዲሱ።', so: 'Dhaqdhaqaaqa gudbinta caymiska waa la cusboonaysiiyey.', ar: 'تم تحديث نشاط إحالة التأمين.', sw: 'Shughuli ya rufaa ya bima imesasishwa.',
  },
  'Agent-sharing consent withdrawn.': {
    am: 'የወኪል ማጋራት ፈቃድ ተነስቷል።', om: 'Hayyamni bakka buʼaaf qooduu haqameera.', ti: 'ፍቓድ ምክፋል ምስ ወኪል ተሳሒቡ።', so: 'Oggolaanshaha la wadaagga wakiilka waa laga noqday.', ar: 'تم سحب الموافقة على المشاركة مع الوكيل.', sw: 'Idhini ya kushiriki na wakala imeondolewa.',
  },
  'Synthetic end-to-end brokerage lifecycle completed. No real business activity occurred.': {
    am: 'ሰው ሠራሽ ከመጀመሪያ እስከ መጨረሻ የደላላ የሥራ ዑደት ተጠናቋል። እውነተኛ የንግድ እንቅስቃሴ አልተከናወነም።',
    om: 'Marsaan hojii daldala inshuraansii jalqabaa hanga dhumaatti nam-tolchee xumurameera. Hojii daldalaa dhugaa hin raawwatamne.',
    ti: 'ዑደት ስራሕ ደላላ ካብ መጀመርታ ክሳብ መወዳእታ ሰብ ሰራሕ ተዛዚሙ። ናይ ሓቂ ንግዳዊ ንጥፈት ኣይተኻየደን።',
    so: 'Wareegga tababarka dilaalka ee bilow ilaa dhammaad waa la dhammaystiray. Wax ganacsi dhab ah ma dhicin.',
    ar: 'اكتملت دورة الوساطة التدريبية الاصطناعية من البداية إلى النهاية. لم يحدث أي نشاط تجاري فعلي.',
    sw: 'Mzunguko wa mafunzo ya udalali kutoka mwanzo hadi mwisho umekamilika. Hakuna shughuli halisi ya biashara iliyofanyika.',
  },
  'Select a synthetic training product.': {
    am: 'ሰው ሠራሽ የሥልጠና ምርት ይምረጡ።', om: 'Oomisha leenjii nam-tolchee filadhaa.', ti: 'ፍርያት ስልጠና ሰብ ሰራሕ ምረጹ።', so: 'Dooro badeecad tababar oo macmal ah.', ar: 'اختر منتجًا تدريبيًا اصطناعيًا.', sw: 'Chagua bidhaa ya mafunzo ya kubuni.',
  },
  'Your session is still active, but some workspace data could not be loaded. Check the connection and reload the workspace.': {
    am: 'ክፍለ ጊዜዎ አሁንም ንቁ ነው፤ ነገር ግን አንዳንድ የሥራ ቦታ ውሂብ ሊጫን አልቻለም። ግንኙነቱን ያረጋግጡና የሥራ ቦታውን እንደገና ይጫኑ።',
    om: 'Yeroon seensaa keessanii ammallee hojii irra jira; taʼus daataan iddoo hojii tokko tokko feʼamuu hin dandeenye. Walqunnamtii mirkaneessaa, iddoo hojii irra deebiʼaa feʼaa.',
    ti: 'ክፍለ ግዜኹም ገና ንጡፍ እዩ፣ ገለ ዳታ ቦታ ስራሕ ግን ምጽዓን ኣይተኻእለን። ርክብ መርምሩን ቦታ ስራሕ እንደገና ጽዕኑን።',
    so: 'Kulankaagu weli wuu firfircoon yahay, balse xogta goobta shaqada qaarkeed lama soo rari karin. Hubi isku-xirka oo dib u soo geli goobta shaqada.',
    ar: 'جلستك ما زالت نشطة، لكن تعذر تحميل بعض بيانات مساحة العمل. تحقق من الاتصال وأعد تحميل مساحة العمل.',
    sw: 'Kipindi chako bado kinatumika, lakini baadhi ya data ya eneo la kazi haikuweza kupakiwa. Kagua muunganisho na upakie upya eneo la kazi.',
  },
  'Property-vendor accounts are provisioned by Global Admin and require the contact person’s National ID before independent activation. Business registration checks are not represented by this document requirement.': {
    am: 'የንብረት አቅራቢ መለያዎች በግሎባል አስተዳዳሪ ይዘጋጃሉ፤ በተናጠል ከመንቃታቸው በፊት የእውቂያ ሰውዬው ብሔራዊ መታወቂያ ያስፈልጋል። ይህ የሰነድ መስፈርት የንግድ ምዝገባ ምርመራን አያመለክትም።',
    om: 'Herregni dhiyeessaa qabeenyaa Admin Addunyaatiin qophaaʼa; hojii irra of dandaʼee ooluu dura ID Biyyaalessaa nama quunnamtii barbaada. Ulaagaan sanadaa kun sakattaʼiinsa galmee daldalaa hin hammatu.',
    ti: 'ሕሳባት ኣቕረብቲ ንብረት ብGlobal Admin ይዳለዉ፤ ብናጻ ቅድሚ ምንቃሖም መለለዪ ሃገር ናይቲ ተራኺብ ሰብ የድሊ። እዚ መስፈርት ሰነድ ምርመራ ምዝገባ ንግዲ ኣየጠቓልልን።',
    so: 'Akoonnada iibiyeyaasha hantida waxaa diyaariya Global Admin, waxaana ka hor hawlgelin madax-bannaan loo baahan yahay Aqoonsiga Qaranka ee qofka lala xiriirayo. Shuruuddan dukumentigu ma matasho hubinta diiwaangelinta ganacsiga.',
    ar: 'يُجهّز المسؤول العام حسابات مورّدي العقارات، ويلزم تقديم الهوية الوطنية لشخص الاتصال قبل التفعيل المستقل. ولا يمثّل هذا المستند فحص تسجيل النشاط التجاري.',
    sw: 'Akaunti za wasambazaji wa mali huandaliwa na Global Admin, na Kitambulisho cha Taifa cha mtu wa mawasiliano kinahitajika kabla ya kuwezesha akaunti kivyake. Sharti hili la hati haliwakilishi ukaguzi wa usajili wa biashara.',
  },
  'Unit added to the property.': {
    am: 'ክፍሉ ወደ ንብረቱ ታክሏል።', om: 'Kutaan qabeenya irratti dabalameera.', ti: 'እቲ ክፍሊ ናብ ንብረት ተወሲኹ።', so: 'Qaybta waxaa lagu daray hantida.', ar: 'تمت إضافة الوحدة إلى العقار.', sw: 'Nyumba imeongezwa kwenye mali.',
  },
  'Listing submitted.': {
    am: 'ማስታወቂያው ቀርቧል።', om: 'Tarreen dhiyaateera.', ti: 'ዝርዝር ቀሪቡ።', so: 'Liiska waa la gudbiyey.', ar: 'تم إرسال القائمة.', sw: 'Tangazo limewasilishwa.',
  },
  'Server address saved.': {
    am: 'የአገልጋይ አድራሻው ተቀምጧል።', om: 'Teessoon sarvarii olkaaʼameera.', ti: 'ኣድራሻ ሰርቨር ተዓቂቡ።', so: 'Cinwaanka server-ka waa la kaydiyey.', ar: 'تم حفظ عنوان الخادم.', sw: 'Anwani ya seva imehifadhiwa.',
  },
  'Password updated successfully.': {
    am: 'የይለፍ ቃሉ በተሳካ ሁኔታ ተዘምኗል።', om: 'Jecha icciitii milkaaʼinaan haaromfameera.', ti: 'መሕለፊ ቃል ብዓወት ተሓዲሱ።', so: 'Furaha sirta ah si guul leh ayaa loo cusboonaysiiyey.', ar: 'تم تحديث كلمة المرور بنجاح.', sw: 'Nenosiri limesasishwa kikamilifu.',
  },
  'Two-step verification enabled.': {
    am: 'ባለሁለት ደረጃ ማረጋገጫ ነቅቷል።', om: 'Mirkaneessi tarkaanfii lama qabu hojii irra ooleera.', ti: 'ምርግጋጽ ክልተ ደረጃ ነቒሑ።', so: 'Xaqiijinta laba-tallaabo waa la hawlgeliyey.', ar: 'تم تفعيل التحقق بخطوتين.', sw: 'Uthibitishaji wa hatua mbili umewashwa.',
  },
  'No business rule changes to save.': {
    am: 'ለማስቀመጥ የንግድ ደንብ ለውጥ የለም።', om: 'Jijjiirraan seera daldalaa olkaaʼu hin jiru.', ti: 'ዝዕቅቦ ለውጢ ሕጊ ንግዲ የለን።', so: 'Ma jiraan isbeddello xeer ganacsi oo la kaydinayo.', ar: 'لا توجد تغييرات في قواعد العمل لحفظها.', sw: 'Hakuna mabadiliko ya kanuni za biashara ya kuhifadhi.',
  },
  'Property pictures uploaded successfully.': {
    am: 'የንብረት ፎቶዎች በተሳካ ሁኔታ ተጭነዋል።', om: 'Suuraawwan qabeenyaa milkaaʼinaan feʼamaniiru.', ti: 'ስእልታት ንብረት ብዓወት ተጽዒኖም።', so: 'Sawirrada hantida si guul leh ayaa loo geliyey.', ar: 'تم تحميل صور العقار بنجاح.', sw: 'Picha za mali zimepakiwa kikamilifu.',
  },
  'Document uploaded for compliance review.': {
    am: 'ሰነዱ ለተገዢነት ግምገማ ተጭኗል።', om: 'Sanadni gamaaggama toʼannoo seeraatiif feʼameera.', ti: 'ሰነድ ንግምገማ ተገዢነት ተጽዒኑ።', so: 'Dukumentiga waxaa loo geliyey dib-u-eegista u hoggaansanaanta.', ar: 'تم تحميل المستند لمراجعته من فريق الامتثال.', sw: 'Hati imepakiwa kwa ukaguzi wa uzingatiaji.',
  },
  'Saved successfully.': {
    am: 'በተሳካ ሁኔታ ተቀምጧል።', om: 'Milkaaʼinaan olkaaʼameera.', ti: 'ብዓወት ተዓቂቡ።', so: 'Si guul leh ayaa loo kaydiyey.', ar: 'تم الحفظ بنجاح.', sw: 'Imehifadhiwa kikamilifu.',
  },
  'Worker verified and ready for matching.': {
    am: 'ሠራተኛው ተረጋግጦ ለማዛመድ ዝግጁ ነው።', om: 'Hojjetaan mirkanaaʼee walitti fiduuf qophaaʼeera.', ti: 'ሰራሕተኛ ተረጋጊጹ ንምዝማድ ድሉው እዩ።', so: 'Shaqaalaha waa la xaqiijiyey wuxuuna diyaar u yahay isku-waafajin.', ar: 'تم التحقق من العامل وأصبح جاهزًا للمطابقة.', sw: 'Mfanyakazi amethibitishwa na yuko tayari kulinganishwa.',
  },
  'Match proposed.': {
    am: 'ማዛመዱ ቀርቧል።', om: 'Walitti fiduun dhiyaateera.', ti: 'ምዝማድ ቀሪቡ።', so: 'Isku-waafajinta waa la soo jeediyey.', ar: 'تم اقتراح المطابقة.', sw: 'Pendekezo la ulinganishaji limetolewa.',
  },
  'Reservation released and request reopened.': {
    am: 'ቦታ ማስያዙ ተለቋል፤ ጥያቄውም እንደገና ተከፍቷል።',
    om: 'Qabannaan gadhiifameera; gaaffiinis irra deebiʼamee banameera.',
    ti: 'ቦታ ምሓዝ ተፈቲሑ፣ ሕቶ ድማ እንደገና ተኸፊቱ።',
    so: 'Boos celintii waa la sii daayey, codsigana dib ayaa loo furay.',
    ar: 'تم إلغاء الحجز وإعادة فتح الطلب.',
    sw: 'Nafasi iliyohifadhiwa imeachiliwa na ombi limefunguliwa tena.',
  },
  'Signed in as {{role}}. Your access is limited to your assigned role and territory.': {
    am: 'እንደ {{role}} ገብተዋል። መዳረሻዎ በተመደበልዎ ሚናና አካባቢ ብቻ የተገደበ ነው።', om: '{{role}} taatanii seentani. Seensaan keessan gahee fi naannoo isiniif kenname qofaan daangeffama.', ti: 'ከም {{role}} ኣቲኹም። መእተዊኹም ብሚናን ከባቢን ዝተመደበልኩም ጥራይ ይውሰን።', so: 'Waxaad ku gashay {{role}}. Gelitaankaagu wuxuu ku kooban yahay doorka iyo deegaanka laguu qoondeeyey.', ar: 'تم تسجيل الدخول بصفتك {{role}}. يقتصر وصولك على الدور والمنطقة المخصصين لك.', sw: 'Umeingia kama {{role}}. Ufikiaji wako una mipaka ya jukumu na eneo ulilopangiwa.',
  },
  'Lease commencement date': { am: 'የኪራይ ውል መጀመሪያ ቀን' },
  'Rent commencement date': { am: 'የኪራይ ክፍያ መጀመሪያ ቀን' },
  'Lease commencement, rent commencement, signature, and possession handover are recorded separately.': {
    am: 'የውል መጀመሪያ፣ የኪራይ ክፍያ መጀመሪያ፣ ፊርማ እና የቤት ርክክብ በተለያዩ መዝገቦች ይመዘገባሉ።',
  },
  'Rent commencement: {{date}}.': { am: 'የኪራይ ክፍያ መጀመሪያ፦ {{date}}።' },
  'Lease commencement: {{commencement}} · Rent commencement: {{rentStart}} · Possession handover: {{handover}}.': {
    am: 'የውል መጀመሪያ፦ {{commencement}} · የኪራይ ክፍያ መጀመሪያ፦ {{rentStart}} · የቤት ርክክብ፦ {{handover}}።',
  },
  'ETB {{rent}} rent · {{status}} · Lease {{start}} to {{end}} · Rent starts {{rentStart}}': {
    am: 'የኪራይ ክፍያ ETB {{rent}} · {{status}} · ውል {{start}} እስከ {{end}} · ኪራይ የሚጀምረው {{rentStart}}',
  },
  'More attendance rows remain in this period. Continue with the next batch.': {
    am: 'በዚህ ወቅት ተጨማሪ የሥራ ሰዓት መዝገቦች አሉ። በሚቀጥለው ባች ይቀጥሉ።',
    om: 'Yeroo kana keessatti galmeewwan argama hojii dabalataa jiru. Tuuta itti aanu waliin itti fufaa.',
    ti: 'ኣብዚ ግዜ ተወሳኺ መዝገባት ሰዓት ስራሕ ኣለዉ። ብቀጻሊ ጉጅለ ቀጽሉ።',
    so: 'Muddadan waxaa ku hadhay diiwaanno xaadiris dheeraad ah. Ku sii wad qaybta xigta.',
    ar: 'ما زالت هناك سجلات حضور إضافية لهذه الفترة. تابع بالدفعة التالية.',
    sw: 'Kuna rekodi zaidi za mahudhurio katika kipindi hiki. Endelea na kundi linalofuata.',
  },
  'More payable rows remain in this period. Continue with the next encrypted export.': {
    am: 'በዚህ ወቅት ተጨማሪ የሚከፈሉ መዝገቦች አሉ። በሚቀጥለው የተመሰጠረ ወደ ውጭ ማስተላለፊያ ይቀጥሉ።',
    om: 'Yeroo kana keessatti galmeewwan kaffalamu dabalataa jiru. Ergaa icciitii itti aanu waliin itti fufaa.',
    ti: 'ኣብዚ ግዜ ተወሳኺ መዝገባት ዝኽፈሉ ኣለዉ። ብቀጻሊ ምስጢራዊ ምልኣኽ ቀጽሉ።',
    so: 'Muddadan waxaa ku hadhay diiwaanno lacag-bixin oo dheeraad ah. Ku sii wad dhoofinta siraysan ee xigta.',
    ar: 'ما زالت هناك سجلات مستحقة إضافية لهذه الفترة. تابع بالتصدير المشفر التالي.',
    sw: 'Kuna rekodi zaidi zinazolipwa katika kipindi hiki. Endelea na uhamishaji fiche unaofuata.',
  },
  'Calculated payable time for {{count}} attendance records. {{warnings}} have warning thresholds to review.': {
    am: 'የሚከፈል ሰዓት ለ{{count}} የመገኘት መዝገቦች ተሰልቷል። የማስጠንቀቂያ ገደቦችን የሚፈልጉ {{warnings}} መዝገቦችን ይገምግሙ።',
    om: 'Yeroon kaffalamu galmee argama hojii {{count}} tiif shallagame. Galmeewwan {{warnings}} akeekkachiisa ulaagaa qabaachuu isaanii gamaaggamaa.',
    ti: 'ዝኽፈል ግዜ ን{{count}} መዝገባት ምህላው ተሰሊሑ። ን{{warnings}} መዝገባት መጠንቀቕታ ገደብ ግምግሙ።',
    so: 'Waqtiga la bixinayo waxaa loo xisaabiyey {{count}} diiwaan xaadiris. Dib u eeg {{warnings}} diiwaan oo leh digniino xad ah.',
    ar: 'تم حساب الوقت المستحق لـ{{count}} سجل حضور. راجع {{warnings}} سجلات تتطلب مراجعة حدود التنبيه.',
    sw: 'Muda unaolipwa imehesabiwa kwa rekodi {{count}} za mahudhurio. Kagua rekodi {{warnings}} zenye tahadhari za viwango.',
  },
  'Calculate next payable-time batch': {
    am: 'ቀጣዩን የሚከፈል ሰዓት ባች አስሉ',
    om: 'Tuuta yeroon kaffalamu itti aanu shallagaa',
    ti: 'ቀጻሊ ጉጅለ ዝኽፈል ግዜ ስልዑ',
    so: 'Xisaabi qaybta xigta ee waqtiga la bixinayo',
    ar: 'احسب الدفعة التالية من الوقت المستحق',
    sw: 'Hesabu kundi linalofuata la muda unaolipwa',
  },
  'Generate next encrypted export batch': {
    am: 'ቀጣዩን የተመሰጠረ የወጪ ፋይል ባች ይፍጠሩ',
    om: 'Tuuta ergaa icciitii itti aanu uumaa',
    ti: 'ቀጻሊ ምስጢራዊ ጉጅለ ምልኣኽ ፍጠሩ',
    so: 'Samee qaybta xigta ee dhoofinta siraysan',
    ar: 'أنشئ دفعة التصدير المشفر التالية',
    sw: 'Tengeneza kundi fiche linalofuata la kuhamisha',
  },
  'Authority': {
    am: 'የባለቤትነት ወይም የውክልና ማረጋገጫ',
    om: 'Abbummaa yookaan bakka bu’ummaa',
    ti: 'ምርግጋጽ ዋንነት ወይ ውክልና',
    so: 'Xaqiijinta lahaanshaha ama wakiilnimada',
    ar: 'إثبات الملكية أو التفويض',
    sw: 'Uthibitisho wa umiliki au uwakilishi',
  },
  'Authority evidence': {
    am: 'ማስረጃ ባለቤትነት ወይም ውክልና',
    om: 'Ragaa abbummaa yookaan bakka bu’ummaa',
    ti: 'መርትዖ ዋንነት ወይ ውክልና',
    so: 'Caddeynta lahaanshaha ama wakiilnimada',
    ar: 'مستندات إثبات الملكية أو التفويض',
    sw: 'Ushahidi wa umiliki au uwakilishi',
  },
  'Submit ownership or delegated-authority evidence': {
    am: 'የባለቤትነት ወይም የውክልና ማስረጃ ያስገቡ',
    om: 'Ragaa abbummaa yookaan bakka bu’ummaa dhiyeessaa',
    ti: 'መርትዖ ዋንነት ወይ ውክልና ኣቕርብ',
    so: 'Gudbi caddeynta lahaanshaha ama wakiilnimada',
    ar: 'قدّم مستندات إثبات الملكية أو التفويض',
    sw: 'Wasilisha ushahidi wa umiliki au uwakilishi',
  },
  'Evidence type': {
    am: 'የማስረጃ ዓይነት',
    om: 'Gosa ragaa',
    ti: 'ዓይነት መርትዖ',
    so: 'Nooca caddeynta',
    ar: 'نوع المستند',
    sw: 'Aina ya ushahidi',
  },
  'Ownership or seller authority': {
    am: 'ባለቤትነት ወይም የሻጭ ውክልና',
    om: 'Abbummaa yookaan bakka bu’ummaa gurguraa',
    ti: 'ዋንነት ወይ ውክልና ሻያጢ',
    so: 'Lahaansho ama awoodda iibiyaha',
    ar: 'الملكية أو تفويض البائع',
    sw: 'Umiliki au mamlaka ya muuzaji',
  },
  'Delegated authority to list': {
    am: 'ለማስታወቂያ የተሰጠ ውክልና',
    om: 'Bakka bu’ummaa beeksisaaf kenname',
    ti: 'ንምዝርዛር ዝተዋህበ ውክልና',
    so: 'Awoodda loo wakiishay liis-gelinta',
    ar: 'تفويض إدراج العقار',
    sw: 'Mamlaka ya uwakilishi wa kutangaza',
  },
  'Evidence document (PDF, JPEG or PNG · max 10 MB)': {
    am: 'የማስረጃ ሰነድ (PDF፣ JPEG ወይም PNG · ከፍተኛ 10 MB)',
    om: 'Galmee ragaa (PDF, JPEG yookaan PNG · hanga 10 MB)',
    ti: 'ሰነድ መርትዖ (PDF፣ JPEG ወይ PNG · ክሳብ 10 MB)',
    so: 'Dukumenti caddeyn ah (PDF, JPEG ama PNG · ugu badnaan 10 MB)',
    ar: 'مستند إثبات (PDF أو JPEG أو PNG · بحد أقصى 10 ميغابايت)',
    sw: 'Hati ya ushahidi (PDF, JPEG au PNG · isiyozidi MB 10)',
  },
  'Upload evidence': {
    am: 'ማስረጃ ይጫኑ',
    om: 'Ragaa olkaaʼaa',
    ti: 'መርትዖ ጽዕኑ',
    so: 'Soo geli caddeynta',
    ar: 'ارفع المستند',
    sw: 'Pakia ushahidi',
  },
  'Resubmit for authority review': {
    am: 'ለውክልና ግምገማ እንደገና ያስገቡ',
    om: 'Gamaaggama bakka bu’ummaatiif irra deebiʼaa dhiyeessaa',
    ti: 'ንግምገማ ውክልና ዳግማይ ኣቕርብ',
    so: 'Dib ugu gudbi dib-u-eegista wakiilnimada',
    ar: 'أعد التقديم لمراجعة التفويض',
    sw: 'Wasilisha tena kwa ukaguzi wa uwakilishi',
  },
  'Owner-authority review queue': {
    am: 'የባለቤት ውክልና ግምገማ ወረፋ',
    om: 'Tarree gamaaggama abbummaa yookaan bakka bu’ummaa',
    ti: 'ረድፊ ግምገማ ዋንነትን ውክልናን',
    so: 'Safka dib-u-eegista lahaanshaha iyo wakiilnimada',
    ar: 'قائمة مراجعة الملكية والتفويض',
    sw: 'Foleni ya ukaguzi wa umiliki na uwakilishi',
  },
  'Inspect scanned ownership or delegated-authority evidence. This operational review is separate from listing moderation.': {
    am: 'የተቃኙ የባለቤትነት ወይም የውክልና ማስረጃዎችን ይመርምሩ። ይህ የሥራ ግምገማ ከዝርዝር ማረጋገጫ የተለየ ነው።',
    om: 'Ragaalee abbummaa yookaan bakka bu’ummaa sakattaʼaman qoradhaa. Gamaaggamni hojii kun qorannoo tarree irraa adda.',
    ti: 'ዝተስካነ መርትዖ ዋንነት ወይ ውክልና መርምሩ። እዚ ናይ ስራሕ ግምገማ ካብ ምምርማር ዝርዝር ዝተፈልየ እዩ።',
    so: 'Dib u eeg caddeynta lahaanshaha ama wakiilnimada ee la baaray. Dib-u-eegistan hawleed way ka duwan tahay dhexdhexaadinta liiska.',
    ar: 'افحص مستندات إثبات الملكية أو التفويض الممسوحة ضوئياً. هذه المراجعة التشغيلية منفصلة عن مراجعة الإعلان.',
    sw: 'Kagua ushahidi uliochanganuliwa wa umiliki au uwakilishi. Ukaguzi huu wa shughuli ni tofauti na ukaguzi wa tangazo.',
  },
  'No property authority cases are awaiting review.': {
    am: 'ለግምገማ የሚጠብቁ የባለቤትነት ወይም የውክልና ጉዳዮች የሉም።',
    om: 'Hojii abbummaa yookaan bakka bu’ummaa gamaaggama eegatu hin jiru.',
    ti: 'ንግምገማ ዝጽበ ጉዳይ ዋንነት ወይ ውክልና የለን።',
    so: 'Ma jiraan kiisaska lahaanshaha ama wakiilnimada ee sugaya dib-u-eegis.',
    ar: 'لا توجد حالات ملكية أو تفويض بانتظار المراجعة.',
    sw: 'Hakuna kesi za umiliki au uwakilishi zinazosubiri ukaguzi.',
  },
  'Approve authority': {
    am: 'ውክልናውን አጽድቅ',
    om: 'Bakka bu’ummaa raggaasi',
    ti: 'ውክልና ኣጽድቕ',
    so: 'Ansixi wakiilnimada',
    ar: 'اعتمد التفويض',
    sw: 'Idhinisha uwakilishi',
  },
  'Apply to rent this property': {
    am: 'ይህን ንብረት ለመከራየት ያመልክቱ',
    om: 'Qabeenya kana kireeffachuuf iyyadhaa',
    ti: 'ነዚ ንብረት ክትካረዩ ኣመልክቱ',
    so: 'Codso inaad kiraysato gurigan',
    ar: 'قدّم طلباً لاستئجار هذا العقار',
    sw: 'Omba kukodisha nyumba hii',
  },
  'Available unit': {
    am: 'ያለው ክፍል',
    om: 'Kutaa jiru',
    ti: 'ዘሎ ክፍሊ',
    so: 'Qaybta bannaan',
    ar: 'الوحدة المتاحة',
    sw: 'Kitengo kinachopatikana',
  },
  'Choose a vacant unit': {
    am: 'ክፍት የሆነ ክፍል ይምረጡ',
    om: 'Kutaa duwwaa filadhaa',
    ti: 'ክፉት ክፍሊ ምረጹ',
    so: 'Dooro qayb bannaan',
    ar: 'اختر وحدة شاغرة',
    sw: 'Chagua kitengo kisicho na mpangaji',
  },
  'Message to the landlord or listing Agent': {
    am: 'ለአከራዩ ወይም ለዝርዝሩ ወኪል የሚላክ መልዕክት',
    om: 'Ergaa abbaa qabeenyaa yookaan bakka bu’aa tarreeffamaaf',
    ti: 'መልእኽቲ ንኣካራዪ ወይ ወኪል ዝርዝር',
    so: 'Fariin loo dirayo mulkiilaha ama wakiilka liiska',
    ar: 'رسالة إلى المالك أو وكيل الإعلان',
    sw: 'Ujumbe kwa mwenye nyumba au wakala wa tangazo',
  },
  'I agree to share my account name and this message with the listing landlord or Agent to review my application.': {
    am: 'ማመልከቻዬን እንዲገመግሙ የመለያዬን ስም እና ይህን መልዕክት ለዝርዝሩ አከራይ ወይም ወኪል ለማጋራት እስማማለሁ።',
    om: 'Iyyannoo koo gamaaggamuuf maqaa herrega koo fi ergaa kana abbaa qabeenyaa tarreeffamaa yookaan bakka bu’aaf qooduuf nan waliigala.',
    ti: 'ምልክታይ ንምግምጋም ስም ኣካውንተይን እዚ መልእኽትን ምስ ኣካራዪ ወይ ወኪል ዝርዝር ንምክፋል እሰማማዕ።',
    so: 'Waxaan oggolahay in magaca akoonkayga iyo farriintan lala wadaago mulkiilaha ama wakiilka liiska si loo eego codsigayga.',
    ar: 'أوافق على مشاركة اسم حسابي وهذه الرسالة مع مالك العقار أو وكيل الإعلان لمراجعة طلبي.',
    sw: 'Nakubali kushiriki jina la akaunti yangu na ujumbe huu na mwenye nyumba au wakala wa tangazo ili kukagua ombi langu.',
  },
  'Submit rental application': {
    am: 'የኪራይ ማመልከቻ ያስገቡ',
    om: 'Iyyannoo kireeffannaa dhiyeessaa',
    ti: 'ምልክታ ክራይ ኣቕርቡ',
    so: 'Gudbi codsiga kirada',
    ar: 'قدّم طلب الإيجار',
    sw: 'Wasilisha ombi la upangaji',
  },
  'Rental application review': {
    am: 'የኪራይ ማመልከቻ ግምገማ',
    om: 'Gamaaggama iyyannoo kireeffannaa',
    ti: 'ግምገማ ምልክታ ክራይ',
    so: 'Dib-u-eegista codsiga kirada',
    ar: 'مراجعة طلب الإيجار',
    sw: 'Ukaguzi wa ombi la upangaji',
  },
  'Review applications manually. AfroLife does not run automated tenant screening. Rejections and requests for information require a reason.': {
    am: 'ማመልከቻዎችን በእጅ ይገምግሙ። AfroLife ራስ-ሰር የተከራይ ምርመራ አያካሂድም። ውድቅ ማድረግ ወይም መረጃ መጠየቅ ምክንያት ይፈልጋል።',
    om: 'Iyyannoowwan harkaan gamaaggamaa. AfroLife qorannoo kireeffataa ofumaan hin raawwatu. Diduun yookaan odeeffannoo gaafachuun sababaa barbaada.',
    ti: 'ምልክታታት ብኢድ ገምግሙ። AfroLife ኣውቶማቲክ ምርመራ ተኻራዪ ኣይገብርን። ምንጻግ ወይ ሓበሬታ ምሕታት ምኽንያት የድሊ።',
    so: 'Codsiyada gacanta ku eeg. AfroLife ma sameeyo baaritaan kirayste oo otomaatig ah. Diidmada iyo codsiga xog dheeraad ah sabab bay u baahan yihiin.',
    ar: 'راجع الطلبات يدوياً. لا تجري AfroLife فحصاً آلياً للمستأجرين. يتطلب الرفض أو طلب المعلومات ذكر السبب.',
    sw: 'Kagua maombi kwa mkono. AfroLife haifanyi uchunguzi wa wapangaji kiotomatiki. Kukataa au kuomba taarifa kunahitaji sababu.',
  },
  'Accept application': {
    am: 'ማመልከቻውን ተቀበል',
    om: 'Iyyannoo fudhadhaa',
    ti: 'ምልክታ ተቐበሉ',
    so: 'Aqbal codsiga',
    ar: 'اقبل الطلب',
    sw: 'Kubali ombi',
  },
  'Reject application': {
    am: 'ማመልከቻውን ውድቅ አድርግ',
    om: 'Iyyannoo didaa',
    ti: 'ምልክታ ንጸጉ',
    so: 'Diid codsiga',
    ar: 'ارفض الطلب',
    sw: 'Kataa ombi',
  },
  'AfroLife displays recorded operational information only. Payment records do not confirm that funds were paid to a landlord; tenant notices are not legal service or termination.': {
    am: 'AfroLife የተመዘገበ የሥራ መረጃን ብቻ ያሳያል። የክፍያ መዝገቦች ገንዘብ ለአከራይ መከፈሉን አያረጋግጡም፤ የተከራይ ማሳወቂያዎችም ሕጋዊ ማስታወቂያ ወይም ውል ማቋረጥ አይደሉም።',
    om: 'AfroLife odeeffannoo hojii galmaaʼe qofa agarsiisa. Galmeen kaffaltii maallaqni abbaa qabeenyaaf kaffalamuu hin mirkaneessu; beeksisni kireeffataa tajaajila seeraa yookaan waliigaltee xumuru miti.',
    ti: 'AfroLife ዝተመዝገበ ናይ ስራሕ ሓበሬታ ጥራይ የርኢ። መዝገብ ክፍሊት ገንዘብ ንኣካራዪ ከም ዝተኸፍለ ኣየረጋግጽን፤ ማስታወቂያ ተኻራዪ ሕጋዊ ምልኣኽ ወይ ምቁራጽ ውዕል ኣይኮነን።',
    so: 'AfroLife waxay muujisaa oo keliya xog hawleed la diiwaangeliyey. Diiwaanka lacag-bixintu ma xaqiijiyo in lacag loo diray mulkiilaha; ogeysiiska kiraystuhuna ma aha adeeg sharci ama joojin heshiis.',
    ar: 'تعرض AfroLife المعلومات التشغيلية المسجلة فقط. سجلات الدفع لا تؤكد وصول الأموال إلى المالك؛ وإشعارات المستأجر ليست تبليغاً قانونياً ولا إنهاءً للعقد.',
    sw: 'AfroLife huonyesha taarifa za shughuli zilizorekodiwa pekee. Rekodi za malipo hazithibitishi kuwa fedha zimelipwa kwa mwenye nyumba; taarifa za mpangaji si huduma ya kisheria wala kusitisha mkataba.',
  },
  'Charges': {
    am: 'ክፍያዎች',
    om: 'Kaffaltiiwwan',
    ti: 'ክፍሊታት',
    so: 'Lacagaha lagu leeyahay',
    ar: 'الرسوم المستحقة',
    sw: 'Ada',
  },
  'Recorded receipts': {
    am: 'የተመዘገቡ ደረሰኞች',
    om: 'Ragaa kaffaltii galmaaʼe',
    ti: 'ዝተመዝገቡ ደረሰኛታት',
    so: 'Rasiidhada la diiwaangeliyey',
    ar: 'الإيصالات المسجلة',
    sw: 'Risiti zilizorekodiwa',
  },
  'Lease documents and signature evidence': {
    am: 'የውል ሰነዶች እና የፊርማ ማስረጃ',
    om: 'Galmeewwan waliigaltee kireeffannaa fi ragaa mallattoo',
    ti: 'ሰነዳት ውዕልን መርትዖ ፊርማን',
    so: 'Dukumentiyada heshiiska kirada iyo caddeynta saxiixa',
    ar: 'مستندات الإيجار وأدلة التوقيع',
    sw: 'Nyaraka za upangaji na ushahidi wa saini',
  },
  'Signature files are retained as evidence only; they do not establish verified identity, provider-backed e-signature, or legal validity.': {
    am: 'የፊርማ ፋይሎች እንደ ማስረጃ ብቻ ይቀመጣሉ፤ የተረጋገጠ ማንነትን፣ በአቅራቢ የተደገፈ ኤሌክትሮኒክ ፊርማን ወይም ሕጋዊ ትክክለኛነትን አያረጋግጡም።',
    om: 'Faayiloonni mallattoo ragaa qofaaf ni kuufamu; eenyummaa mirkanaaʼe, mallattoo elektirooniksii dhiyeessaan deeggarame yookaan seeraan fudhatama qabaachuu hin mirkaneessan.',
    ti: 'ፋይላት ፊርማ ከም መርትዖ ጥራይ ይዕቀቡ፤ ዝተረጋገጸ መንነት፣ ብኣቕራቢ ዝተደገፈ ኤሌክትሮኒካዊ ፊርማ ወይ ሕጋዊ ቅኑዕነት ኣየረጋግጹን።',
    so: 'Faylasha saxiixa waxaa loo hayaa caddeyn keliya; ma xaqiijiyaan aqoonsi la hubiyey, saxiix elektaroonig ah oo adeeg-bixiye taageeray, ama ansax sharci.',
    ar: 'تُحفظ ملفات التوقيع كأدلة فقط؛ ولا تثبت الهوية الموثقة أو التوقيع الإلكتروني المدعوم من مزود أو الصلاحية القانونية.',
    sw: 'Faili za saini huhifadhiwa kama ushahidi pekee; hazithibitishi utambulisho uliothibitishwa, saini ya kielektroniki inayoungwa mkono na mtoa huduma, au uhalali wa kisheria.',
  },
  'No lease document is available yet.': {
    am: 'Bado hakuna hati ya upangaji inayopatikana.',
    om: 'Galmeen kireeffannaa ammaaf hin jiru.',
    ti: 'ገና ሰነድ ክራይ የለን።',
    so: 'Weli ma jiro dukumenti heshiis kiro oo la heli karo.',
    ar: 'لا يتوفر مستند إيجار بعد.',
    sw: 'Bado hakuna hati ya upangaji inayopatikana.',
  },
  'Operational notices': {
    am: 'የሥራ ማሳወቂያዎች',
    om: 'Beeksisa hojii',
    ti: 'ናይ ስራሕ ማስታወቂያታት',
    so: 'Ogeysiisyada hawlgalka',
    ar: 'الإشعارات التشغيلية',
    sw: 'Taarifa za shughuli',
  },
  'Send an operational notice to the property manager': {
    am: 'ለንብረት አስተዳዳሪው የሥራ ማሳወቂያ ይላኩ',
    om: 'Beeksisa hojii bulchaa qabeenyaatti ergaa',
    ti: 'ናይ ስራሕ ማስታወቂያ ናብ ኣመሓዳሪ ንብረት ስደዱ',
    so: 'U dir ogeysiis hawleed maamulaha guriga',
    ar: 'أرسل إشعاراً تشغيلياً إلى مدير العقار',
    sw: 'Tuma taarifa ya shughuli kwa msimamizi wa nyumba',
  },
  'This creates an operational record only. It does not verify legal service or change/end your lease.': {
    am: 'ይህ የሥራ መዝገብ ብቻ ይፈጥራል። ሕጋዊ ማሳወቂያን አያረጋግጥም ወይም የኪራይ ውልዎን አይቀይርም/አያቋርጥም።',
    om: 'Kun galmee hojii qofa uuma. Beeksisa seeraa hin mirkaneessu yookaan waliigaltee kireeffannaa keessan hin jijjiiru/hin xumuru.',
    ti: 'እዚ መዝገብ ስራሕ ጥራይ ይፈጥር። ሕጋዊ ምልኣኽ ኣየረጋግጽን ወይ ውዕል ክራይኩም ኣይቅይርን/ኣየቋርጽን።',
    so: 'Tani waxay abuuraysaa diiwaan hawleed oo keliya. Ma xaqiijiso ogeysiis sharci mana beddesho/joojiso heshiiskaaga kirada.',
    ar: 'ينشئ هذا سجلاً تشغيلياً فقط. ولا يثبت التبليغ القانوني ولا يغير عقد الإيجار أو ينهيه.',
    sw: 'Hii huunda rekodi ya shughuli pekee. Haithibitishi huduma ya kisheria wala kubadilisha/kumaliza mkataba wako wa upangaji.',
  },
  'Report a maintenance issue': {
    am: 'የጥገና ችግር ሪፖርት ያድርጉ',
    om: 'Rakkoo suphaa gabaasaa',
    ti: 'ጸገም ጽገና ሪፖርት ግበሩ',
    so: 'Soo sheeg cilad dayactir',
    ar: 'أبلغ عن مشكلة صيانة',
    sw: 'Ripoti tatizo la matengenezo',
  },
  'Safety issues are escalated as urgent. Photos are stored only after a clean malware scan; if scanning is unavailable, the request will remain recorded and the photo upload will be reported as failed.': {
    am: 'የደህንነት ጉዳዮች እንደ አስቸኳይ ይላካሉ። ፎቶዎች ከንጹህ የማልዌር ምርመራ በኋላ ብቻ ይቀመጣሉ፤ ምርመራው ካልተገኘ ጥያቄው ይመዘገባል እና የፎቶ መጫኑ እንደ ያልተሳካ ይገለጻል።',
    om: 'Dhimmoota nageenyaa ariifachiisaa taʼanii ol-kaafamu. Suuraan qorannoo malware qulqulluu booda qofa kuufama; qorannoon yoo hin jirre, gaaffiin ni galmaaʼa garuu olkaaʼuun suuraa akka hin milkoofne ni gabaafama.',
    ti: 'ጉዳያት ድሕነት ከም ህጹጽ ይለዓሉ። ስእልታት ድሕሪ ንጹህ ምርመራ malware ጥራይ ይዕቀቡ፤ ምርመራ እንተዘይሃልዩ ሕቶ ይምዝገብ እሞ ስእሊ ምጽዓን ከም ዘይተሳኸዐ ይሕበር።',
    so: 'Arrimaha badbaadada waxaa loo gudbiyaa si degdeg ah. Sawirrada waxaa la kaydiyaa oo keliya marka baaritaanka malware-ku nadiif noqdo; haddii baaritaanku maqan yahay, codsigu waa la diiwaangelinayaa, sawir-gelintana waxaa lagu calaamadeynayaa inay fashilantay.',
    ar: 'تُصعّد مسائل السلامة على أنها عاجلة. لا تُحفظ الصور إلا بعد فحص برمجيات خبيثة سليم؛ وإذا تعذر الفحص يُسجل الطلب ويُبلغ عن فشل رفع الصورة.',
    sw: 'Masuala ya usalama hupewa kipaumbele cha dharura. Picha huhifadhiwa tu baada ya uchunguzi safi wa programu hasidi; uchunguzi usipopatikana, ombi hubaki limerekodiwa na upakiaji wa picha huripotiwa kuwa umeshindwa.',
  },
  'My maintenance requests': {
    am: 'የጥገና ጥያቄዎቼ',
    om: 'Gaaffiiwwan suphaa koo',
    ti: 'ሕቶታተይ ጽገና',
    so: 'Codsiyadayda dayactirka',
    ar: 'طلبات الصيانة الخاصة بي',
    sw: 'Maombi yangu ya matengenezo',
  },
  'My rental applications': {
    am: 'የኪራይ ማመልከቻዎቼ',
    om: 'Iyyannoowwan kireeffannaa koo',
    ti: 'ምልክታታተይ ክራይ',
    so: 'Codsiyadayda kirada',
    ar: 'طلبات الإيجار الخاصة بي',
    sw: 'Maombi yangu ya upangaji',
  },
  'Your application was accepted for follow-up. This is not an executed lease and does not authorize occupancy.': {
    am: 'ማመልከቻዎ ለቀጣይ እርምጃ ተቀባይነት አግኝቷል። ይህ የተፈጸመ የኪራይ ውል አይደለም እና በንብረቱ ላይ እንዲኖሩ ፈቃድ አይሰጥም።',
    om: 'Iyyannoon keessan hordoffiif fudhatameera. Kun waliigaltee kireeffannaa raawwatame miti; qabeenya keessa jiraachuuf hayyama hin kennu.',
    ti: 'ምልክታኹም ንቀጻሊ ምክትታል ተቐቢሉ። እዚ ዝተፈጸመ ውዕል ክራይ ኣይኮነን፣ ኣብቲ ንብረት ክትነብሩ ፍቓድ ኣይህብን።',
    so: 'Codsigaaga waxaa loo aqbalay dabagal. Tani ma aha heshiis kiro oo la fuliyey mana kuu oggolaanayso inaad guriga degto.',
    ar: 'قُبل طلبك للمتابعة. هذا ليس عقد إيجار نافذاً ولا يمنح إذناً بالإشغال.',
    sw: 'Ombi lako limekubaliwa kwa ufuatiliaji. Huu si mkataba wa upangaji uliotekelezwa wala ruhusa ya kukaa kwenye nyumba.',
  },
  'Lease commencement, rent commencement, signature, and possession handover are recorded separately.': {
    am: 'የውል መጀመሪያ፣ የኪራይ ክፍያ መጀመሪያ፣ ፊርማ እና የቤት ርክክብ በተለያዩ መዝገቦች ይመዘገባሉ።',
    om: 'Jalqaba waliigaltee, jalqaba kaffaltii kireeffannaa, mallattoo fi dabarsa qabiyyee addaan galmaaʼu.',
    ti: 'ምጅማር ውዕል፣ ምጅማር ክፍሊት ክራይ፣ ፊርማን ርክክብ ንብረትን ብተፈላለየ ይምዝገቡ።',
    so: 'Bilowga heshiiska, bilowga kirada, saxiixa iyo wareejinta guriga si gooni ah ayaa loo diiwaangeliyaa.',
    ar: 'يُسجل بدء العقد وبدء الإيجار والتوقيع وتسليم الحيازة كلٌ على حدة.',
    sw: 'Mwanzo wa mkataba, mwanzo wa kodi, saini na makabidhiano ya umiliki hurekodiwa kando.',
  },
  'not recorded': {
    am: 'አልተመዘገበም',
    om: 'Hin galmoofne',
    ti: 'ኣይተመዝገበን',
    so: 'Lama diiwaangelin',
    ar: 'غير مسجل',
    sw: 'Haijarekodiwa',
  },
  'Signature uploads are evidence only and do not verify signer identity or legal validity.': {
    am: 'የተጫኑ ፊርማዎች ማስረጃ ብቻ ናቸው፤ የፈራሚውን ማንነት ወይም ሕጋዊ ትክክለኛነት አያረጋግጡም።',
    om: 'Mallattoon olkaaʼame ragaa qofa; eenyummaa mallatteessaa yookaan seeraan fudhatama qabaachuu hin mirkaneessu.',
    ti: 'ዝተጸዓነ ፊርማ መርትዖ ጥራይ እዩ፤ መንነት ፈራሚ ወይ ሕጋዊ ቅኑዕነት ኣየረጋግጽን።',
    so: 'Saxiixyada la geliyey waa caddeyn keliya mana xaqiijiyaan aqoonsiga saxiixaha ama ansaxnimada sharciga.',
    ar: 'التوقيعات المرفوعة أدلة فقط ولا تثبت هوية الموقّع أو الصلاحية القانونية.',
    sw: 'Saini zilizopakiwa ni ushahidi pekee na hazithibitishi utambulisho wa mtia saini au uhalali wa kisheria.',
  },
  'The code is displayed once. Deliver it to the tenant through a separately verified contact channel; there is no automatic SMS delivery.': {
    am: 'ኮዱ አንድ ጊዜ ብቻ ይታያል። በተለየ የተረጋገጠ የመገናኛ መንገድ ለተከራዩ ያድርሱት፤ አውቶማቲክ የSMS ማድረስ የለም።',
    om: 'Koodiin yeroo tokko qofa mulʼata. Karaalee quunnamtii addaan mirkanaaʼe fayyadamuun kireeffataatti kennaa; SMS ofumaan hin ergamu.',
    ti: 'እቲ ኮድ ሓንሳብ ጥራይ ይርአ። ብተፈልየ ዝተረጋገጸ መንገዲ ርክብ ናብ ተኻራዪ ኣብጽሕዎ፤ ኣውቶማቲክ SMS የለን።',
    so: 'Koodhka hal mar oo keliya ayaa la muujiyaa. U gudbi kiraystaha adigoo adeegsanaya marin xiriir oo si gooni ah loo xaqiijiyey; SMS otomaatig ah ma jiro.',
    ar: 'يُعرض الرمز مرة واحدة. سلّمه للمستأجر عبر قناة اتصال تم التحقق منها بشكل مستقل؛ لا يوجد إرسال تلقائي عبر SMS.',
    sw: 'Msimbo huonyeshwa mara moja tu. Mfikishie mpangaji kupitia njia ya mawasiliano iliyothibitishwa kando; hakuna utumaji wa SMS wa moja kwa moja.',
  },
  'Rental application submitted to the property listing manager for human review.': {
    am: 'የኪራይ ማመልከቻው ለሰው ግምገማ ለንብረት ዝርዝር አስተዳዳሪ ተልኳል።',
    om: 'Iyyannoon kireeffannaa gamaaggama namaatiif bulchaa tarree qabeenyaatti ergameera.',
    ti: 'ምልክታ ክራይ ብሰብ ንክግምገም ናብ ኣመሓዳሪ ዝርዝር ንብረት ተላኢኹ።',
    so: 'Codsiga kirada waxaa loo diray maamulaha liiska guriga si qof u eego.',
    ar: 'أُرسل طلب الإيجار إلى مدير الإعلان لمراجعته بشرياً.',
    sw: 'Ombi la upangaji limetumwa kwa msimamizi wa tangazo la nyumba ili likaguliwe na mtu.',
  },
  'Your additional information was sent to the listing manager.': {
    am: 'ተጨማሪ መረጃዎ ለዝርዝር አስተዳዳሪው ተልኳል።',
    om: 'Odeeffannoon dabalataa keessan bulchaa tarreeffamaatti ergameera.',
    ti: 'ተወሳኺ ሓበሬታኹም ናብ ኣመሓዳሪ ዝርዝር ተላኢኹ።',
    so: 'Xogtaada dheeraadka ah waxaa loo diray maamulaha liiska.',
    ar: 'أُرسلت معلوماتك الإضافية إلى مدير الإعلان.',
    sw: 'Taarifa zako za ziada zimetumwa kwa msimamizi wa tangazo.',
  },
  'Resident access linked to this customer account.': {
    am: 'የነዋሪው መዳረሻ ከዚህ የደንበኛ መለያ ጋር ተያይዟል።',
    om: 'Seensaan jiraataa herrega maamila kana waliin walqabsiifameera.',
    ti: 'መእተዊ ነባሪ ምስዚ ኣካውንት ዓሚል ተተሓሒዙ።',
    so: 'Gelitaanka degganaha waxaa lagu xiray akoonkan macaamiisha.',
    ar: 'تم ربط وصول المقيم بحساب العميل هذا.',
    sw: 'Ufikiaji wa mkazi umeunganishwa na akaunti hii ya mteja.',
  },
  'Tenant notice recorded for operational follow-up only; no legal status was changed.': {
    am: 'የተከራይ ማሳወቂያ ለሥራ ክትትል ብቻ ተመዝግቧል፤ ምንም የሕግ ሁኔታ አልተቀየረም።',
    om: 'Beeksisni kireeffataa hordoffii hojii qofaaf galmaaʼeera; haalli seeraa hin jijjiiramne.',
    ti: 'ማስታወቂያ ተኻራዪ ንክትትል ስራሕ ጥራይ ተመዝጊቡ፤ ሕጋዊ ኩነታት ኣይተቐየረን።',
    so: 'Ogeysiiska kiraystaha waxaa loo diiwaangeliyey dabagal hawleed oo keliya; wax xaalad sharci ah lama beddelin.',
    ar: 'سُجل إشعار المستأجر للمتابعة التشغيلية فقط؛ ولم تتغير أي حالة قانونية.',
    sw: 'Taarifa ya mpangaji imerekodiwa kwa ufuatiliaji wa shughuli pekee; hakuna hali ya kisheria iliyobadilishwa.',
  },
  'Maintenance request submitted. Safety issues are marked urgent.': {
    am: 'የጥገና ጥያቄ ተልኳል። የደህንነት ጉዳዮች አስቸኳይ ተብለው ተመዝግበዋል።',
    om: 'Gaaffiin suphaa ergameera. Dhimmoota nageenyaa ariifachiisaa jedhanii mallatteeffamaniiru.',
    ti: 'ሕቶ ጽገና ተላኢኹ። ጉዳያት ድሕነት ከም ህጹጽ ተመልኪቶም።',
    so: 'Codsiga dayactirka waa la diray. Arrimaha badbaadada waxaa lagu calaamadeeyey degdeg.',
    ar: 'أُرسل طلب الصيانة. وتم تصنيف مسائل السلامة على أنها عاجلة.',
    sw: 'Ombi la matengenezo limetumwa. Masuala ya usalama yamewekewa alama ya dharura.',
  },
  'Photo passed malware scanning and was added to your maintenance request.': {
    am: 'ፎቶው የማልዌር ምርመራን አልፎ ወደ የጥገና ጥያቄዎ ተጨምሯል።',
    om: 'Suuraan qorannoo malware darbee gaaffii suphaa keessan irratti dabalameera.',
    ti: 'ስእሊ ምርመራ malware ሓሊፉ ናብ ሕቶ ጽገናኹም ተወሲኹ።',
    so: 'Sawirku wuxuu ka gudbay baaritaanka malware-ka waxaana lagu daray codsigaaga dayactirka.',
    ar: 'اجتازت الصورة فحص البرمجيات الخبيثة وأُضيفت إلى طلب الصيانة.',
    sw: 'Picha imefaulu uchunguzi wa programu hasidi na imeongezwa kwenye ombi lako la matengenezo.',
  },
  'Property listing saved. Upload ownership or delegated-authority evidence; it remains unavailable to customers until authority and listing reviews are approved.': {
    am: 'የንብረት ዝርዝሩ ተቀምጧል። የባለቤትነት ወይም የውክልና ማስረጃ ይጫኑ፤ የውክልና እና የዝርዝር ግምገማዎች እስኪፀድቁ ድረስ ለደንበኞች አይታይም።',
    om: 'Tarreen qabeenyaa olkaaʼameera. Ragaa abbummaa yookaan bakka bu’ummaa olkaaʼaa; hanga gamaaggamni bakka bu’ummaa fi tarree raggaʼutti maamiltootaaf hin mulʼatu.',
    ti: 'ዝርዝር ንብረት ተዓቂቡ። መርትዖ ዋንነት ወይ ውክልና ጽዕኑ፤ ግምገማ ውክልናን ዝርዝርን ክሳብ ዝጸድቕ ንዓማዊል ኣይርአን።',
    so: 'Liiska guriga waa la kaydiyey. Soo geli caddeynta lahaanshaha ama wakiilnimada; macaamiishu ma arki karaan ilaa dib-u-eegista lahaanshaha iyo liisku ansaxaan.',
    ar: 'حُفظ إعلان العقار. ارفع مستند إثبات الملكية أو التفويض؛ ولن يظهر للعملاء حتى اعتماد مراجعة الملكية والإعلان.',
    sw: 'Tangazo la nyumba limehifadhiwa. Pakia ushahidi wa umiliki au uwakilishi; halitaonekana kwa wateja hadi ukaguzi wa umiliki na tangazo uidhinishwe.',
  },
  'Choose an ownership or delegated-authority document.': {
    am: 'የባለቤትነት ወይም የውክልና ሰነድ ይምረጡ።',
    om: 'Galmee abbummaa yookaan bakka bu’ummaa filadhaa.',
    ti: 'ሰነድ ዋንነት ወይ ውክልና ምረጹ።',
    so: 'Dooro dukumenti lahaansho ama wakiilnimo.',
    ar: 'اختر مستند ملكية أو تفويض.',
    sw: 'Chagua hati ya umiliki au uwakilishi.',
  },
  'Malware-scanned property authority evidence uploaded.': {
    am: 'የንብረት ውክልና ማስረጃው በማልዌር ምርመራ ተፈትሾ ተጭኗል።',
    om: 'Ragaan bakka bu’ummaa qabeenyaa qorannoo malware booda olkaaʼameera.',
    ti: 'መርትዖ ውክልና ንብረት ድሕሪ ምርመራ malware ተጸዓነ።',
    so: 'Caddeynta wakiilnimada guriga waa la baaray waxaana la soo geliyey.',
    ar: 'رُفعت مستندات تفويض العقار بعد فحصها من البرمجيات الخبيثة.',
    sw: 'Ushahidi wa uwakilishi wa nyumba umepakiwa baada ya kuchunguzwa dhidi ya programu hasidi.',
  },
  'Property authority evidence submitted for independent review.': {
    am: 'የንብረት ውክልና ማስረጃ ለገለልተኛ ግምገማ ቀርቧል።',
    om: 'Ragaan bakka bu’ummaa qabeenyaa gamaaggama walabaaf dhiyaateera.',
    ti: 'መርትዖ ውክልና ንብረት ንናጻ ግምገማ ቀሪቡ።',
    so: 'Caddeynta wakiilnimada guriga waxaa loo gudbiyey dib-u-eegis madax-bannaan.',
    ar: 'قُدمت مستندات تفويض العقار لمراجعة مستقلة.',
    sw: 'Ushahidi wa uwakilishi wa nyumba umewasilishwa kwa ukaguzi huru.',
  },
  'One-time tenant access code issued. The code was displayed once and expires in seven days.': {
    am: 'የአንድ ጊዜ የተከራይ መዳረሻ ኮድ ተሰጥቷል። ኮዱ አንድ ጊዜ ታይቷል እና በሰባት ቀናት ውስጥ ያበቃል።',
    om: 'Koodiin seensaa yeroo tokko qofa kireeffataaf kennameera. Koodiin yeroo tokko mulʼatee guyyaa torba keessatti dhuma.',
    ti: 'ኮድ መእተዊ ክራይተኛ ንሓንሳብ ተዋሂቡ። እቲ ኮድ ሓንሳብ ተራእዩ ኣብ ሸውዓተ መዓልቲ ይውዳእ።',
    so: 'Koodhka gelitaanka hal-mar ah ee kiraystaha waa la bixiyey. Hal mar ayaa la muujiyey wuxuuna dhacayaa toddoba maalmood gudahood.',
    ar: 'صدر رمز وصول للمستأجر يُستخدم مرة واحدة. عُرض الرمز مرة واحدة وتنتهي صلاحيته خلال سبعة أيام.',
    sw: 'Msimbo wa ufikiaji wa mpangaji wa matumizi moja umetolewa. Ulionyeshwa mara moja na utaisha baada ya siku saba.',
  },
  'Resident portal access revoked.': {
    am: 'የነዋሪ ፖርታል መዳረሻ ተሰርዟል።',
    om: 'Seensaan poortaalii jiraataa haqameera.',
    ti: 'መእተዊ ፖርታል ነባሪ ተሰሪዙ።',
    so: 'Gelitaanka bogga degganaha waa laga noqday.',
    ar: 'أُلغي وصول بوابة المقيم.',
    sw: 'Ufikiaji wa lango la mkazi umebatilishwa.',
  },
  'Describe the new authority evidence being submitted (at least 10 characters).': {
    am: 'የሚቀርበውን አዲስ የውክልና ማስረጃ ይግለጹ (ቢያንስ 10 ቁምፊዎች)።',
    om: 'Ragaa bakka bu’ummaa haaraa dhiyaatu ibsaa (yoo xiqqaate arfiilee 10).',
    ti: 'እቲ ዝቐርብ ሓድሽ መርትዖ ውክልና ግለጹ (ብውሑዱ 10 ፊደላት)።',
    so: 'Sharax caddeynta wakiilnimada cusub ee la gudbinayo (ugu yaraan 10 xaraf).',
    ar: 'صف مستند التفويض الجديد المقدم (10 أحرف على الأقل).',
    sw: 'Eleza ushahidi mpya wa uwakilishi unaowasilishwa (angalau herufi 10).',
  },
  'AfroLife Support': {
    am: 'የAfroLife ድጋፍ', om: 'Deeggarsa AfroLife', ti: 'ደገፍ AfroLife', so: 'Taageerada AfroLife', ar: 'دعم AfroLife', sw: 'Usaidizi wa AfroLife',
  },
  'Role-aware assistant and peer support': {
    am: 'ከእርስዎ ሚና ጋር የተያያዘ አጋዥና የባልደረባ ድጋፍ', om: 'Gargaaraa gahee keessanii fi deeggarsa ogeessaa', ti: 'ምስ ግደኹም ዝተኣሳሰር ሓጋዚን ደገፍ መሳርሕትን', so: 'Kaaliye ku xiran doorkaaga iyo taageerada shaqaalaha', ar: 'مساعد ودعم من موظفي الدعم وفقاً لدورك', sw: 'Msaidizi na usaidizi wa wafanyakazi kulingana na jukumu lako',
  },
  'Your access and support options follow your AfroLife role.': {
    am: 'የመዳረሻዎና የድጋፍ አማራጮችዎ በAfroLife ሚናዎ መሠረት ይወሰናሉ።', om: 'Seensaa fi filannoowwan deeggarsaa keessan gahee AfroLife keessaniin murtaa’u.', ti: 'መእተዊኹምን ኣማራጺታት ደገፍኩምን ብግደ AfroLife ይውሰኑ።', so: 'Helitaankaaga iyo ikhtiyaarrada taageeradu waxay ku xiran yihiin doorkaaga AfroLife.', ar: 'يتحدد وصولك وخيارات الدعم وفقاً لدورك في AfroLife.', sw: 'Ufikiaji na chaguo zako za usaidizi hutegemea jukumu lako la AfroLife.',
  },
  'Online support agents: {{count}}': {
    am: 'በመስመር ላይ ያሉ የድጋፍ ሰጪዎች፦ {{count}}', om: 'Ogeeyyii deeggarsa toora interneetii irra jiran: {{count}}', ti: 'ኣብ መስመር ዘለዉ ሰራሕተኛታት ደገፍ፦ {{count}}', so: 'Wakiillada taageerada ee khadka jooga: {{count}}', ar: 'موظفو الدعم المتصلون: {{count}}', sw: 'Wahudumu wa usaidizi walio mtandaoni: {{count}}',
  },
  'Make me available': {
    am: 'ለድጋፍ ዝግጁ እንደሆንኩ አሳይ', om: 'Deeggarsaaf qophaa’aa ta’uu koo agarsiisi', ti: 'ንደገፍ ድሉው ምዃነይ ኣርኢ', so: 'Muuji inaan diyaar u ahay taageero', ar: 'إظهار أنني متاح للدعم', sw: 'Onyesha kuwa niko tayari kusaidia',
  },
  'Stop offering support': {
    am: 'ድጋፍ መስጠት አቁም', om: 'Deeggarsa kennuu dhaabi', ti: 'ደገፍ ምሃብ ኣቋርጽ', so: 'Jooji bixinta taageerada', ar: 'إيقاف تقديم الدعم', sw: 'Acha kutoa usaidizi',
  },
  'My conversations': {
    am: 'ውይይቶቼ', om: 'Mariwwan koo', ti: 'ዝርርባተይ', so: 'Wadahadalladayda', ar: 'محادثاتي', sw: 'Mazungumzo yangu',
  },
  'Start a new support request': {
    am: 'አዲስ የድጋፍ ጥያቄ ጀምር', om: 'Gaaffii deeggarsa haaraa jalqabi', ti: 'ሓድሽ ሕቶ ደገፍ ጀምር', so: 'Bilow codsi taageero cusub', ar: 'بدء طلب دعم جديد', sw: 'Anzisha ombi jipya la usaidizi',
  },
  'Send request': {
    am: 'ጥያቄ ላክ', om: 'Gaaffii ergi', ti: 'ሕቶ ስደድ', so: 'Dir codsiga', ar: 'إرسال الطلب', sw: 'Tuma ombi',
  },
  'Requests awaiting support': {
    am: 'ድጋፍ የሚጠብቁ ጥያቄዎች', om: 'Gaaffii deeggarsa eeggatan', ti: 'ሕቶታት ደገፍ ዝጽበዩ', so: 'Codsiyada sugaya taageero', ar: 'الطلبات التي تنتظر الدعم', sw: 'Maombi yanayosubiri usaidizi',
  },
  'Awaiting response': {
    am: 'ምላሽ እየተጠበቀ ነው', om: 'Deebii eegaa jira', ti: 'መልሲ ይጽበ ኣሎ', so: 'Jawaab ayaa la sugayaa', ar: 'بانتظار الرد', sw: 'Inasubiri jibu',
  },
  'Assigned to support': {
    am: 'ለድጋፍ ተመድቧል', om: 'Deeggarsaaf ramadameera', ti: 'ንደገፍ ተመዲቡ', so: 'Taageero ayaa loo xilsaaray', ar: 'أُحيل إلى الدعم', sw: 'Imekabidhiwa kwa usaidizi',
  },
  'Claim conversation': {
    am: 'ውይይቱን ውሰድ', om: 'Mariicha fudhadhu', ti: 'ነቲ ዝርርብ ተረከብ', so: 'La wareeg wada hadalka', ar: 'استلام المحادثة', sw: 'Chukua mazungumzo',
  },
  'Conversation': {
    am: 'ውይይት', om: 'Mari', ti: 'ዝርርብ', so: 'Wadahadal', ar: 'محادثة', sw: 'Mazungumzo',
  },
  'Message': {
    am: 'መልዕክት', om: 'Ergaa', ti: 'መልእኽቲ', so: 'Farriin', ar: 'رسالة', sw: 'Ujumbe',
  },
  'Send message': {
    am: 'መልዕክት ላክ', om: 'Ergaa ergi', ti: 'መልእኽቲ ስደድ', so: 'Dir farriinta', ar: 'إرسال الرسالة', sw: 'Tuma ujumbe',
  },
  'Start a conversation by describing what you need.': {
    am: 'የሚያስፈልግዎትን በመግለጽ ውይይት ይጀምሩ።', om: 'Wanta barbaaddan ibsuun marii jalqabaa.', ti: 'ዘድልየኩም ብምግላጽ ዝርርብ ጀምሩ።', so: 'Ku bilow wada hadalka adigoo sharxaya waxa aad u baahan tahay.', ar: 'ابدأ المحادثة بوصف ما تحتاج إليه.', sw: 'Anza mazungumzo kwa kueleza unachohitaji.',
  },
  'You': {
    am: 'እርስዎ', om: 'Isin', ti: 'ንስኹም', so: 'Adiga', ar: 'أنت', sw: 'Wewe',
  },
  'AfroLife support': {
    am: 'የAfroLife ድጋፍ', om: 'Deeggarsa AfroLife', ti: 'ደገፍ AfroLife', so: 'Taageerada AfroLife', ar: 'دعم AfroLife', sw: 'Usaidizi wa AfroLife',
  },
  'Open property services': {
    am: 'የንብረት አገልግሎቶችን ክፈት', om: 'Tajaajila qabeenyaa bani', ti: 'ኣገልግሎታት ንብረት ክፈት', so: 'Fur adeegyada hantida', ar: 'فتح خدمات العقارات', sw: 'Fungua huduma za mali',
  },
  'Open workforce tools': {
    am: 'የሠራተኛ መሣሪያዎችን ክፈት', om: 'Meeshaalee humna hojii bani', ti: 'መሳርሒታት ሓይሊ ሰራሕተኛ ክፈት', so: 'Fur qalabka shaqaalaha', ar: 'فتح أدوات القوى العاملة', sw: 'Fungua zana za wafanyakazi',
  },
  'Open support cases': {
    am: 'የድጋፍ ጉዳዮችን ክፈት', om: 'Dhimmoota deeggarsaa bani', ti: 'ጉዳያት ደገፍ ክፈት', so: 'Fur kiisaska taageerada', ar: 'فتح طلبات الدعم', sw: 'Fungua kesi za usaidizi',
  },
  'Your support request is private to you and the support agent who claims it. Do not send passwords, payment card details, or authentication codes.': {
    am: 'የድጋፍ ጥያቄዎ ለእርስዎና ጥያቄውን ለወሰደው የድጋፍ ሰጪ ብቻ የግል ነው። የይለፍ ቃል፣ የክፍያ ካርድ ወይም የማረጋገጫ ኮድ አይላኩ።', om: 'Gaaffiin deeggarsaa keessan isinii fi ogeessa deeggarsaa isa fudhate qofaaf iccitiidha. Jecha icciitii, odeeffannoo kaardii kaffaltii ykn koodii mirkaneessaa hin erginaa.', ti: 'ሕቶ ደገፍኩም ንኣኻትኩምን ነቲ ዝተረከቦ ሰራሕተኛ ደገፍን ጥራይ ውልቃዊ እዩ። መሕለፊ ቃል፣ ዝርዝር ካርድ ክፍሊት ወይ ኮድ መረጋገጺ ኣይትስደዱ።', so: 'Codsigaaga taageeradu waa mid adiga iyo wakiilka la wareega oo keliya arki karaan. Ha dirin furaha sirta ah, faahfaahinta kaarka lacag-bixinta ama koodhadhka xaqiijinta.', ar: 'طلب الدعم خاص بك وبموظف الدعم الذي يتولاه فقط. لا ترسل كلمات المرور أو بيانات بطاقات الدفع أو رموز المصادقة.', sw: 'Ombi lako la usaidizi ni la faragha kwako na mhudumu anayelichukua pekee. Usitume nywila, maelezo ya kadi ya malipo au misimbo ya uthibitishaji.',
  },
  'Automated answers are not enabled in this support pilot. Existing property, workforce, and support tools remain available.': {
    am: 'በዚህ የድጋፍ ሙከራ ራስ-ሰር መልሶች አልተነቁም። ነባር የንብረት፣ የሠራተኛ እና የድጋፍ መሣሪያዎች አሁንም ይገኛሉ።', om: 'Deebiin ofumaan kennamu qorannoo deeggarsa kana keessatti hin banamne. Meeshaaleen qabeenyaa, humna hojii fi deeggarsa jiran ni hojjetu.', ti: 'ኣብዚ ፈተነ ደገፍ ብኣውቶማቲክ ዝወሃብ መልሲ ኣይተኣከበን። ዘለዉ ኣገልግሎታት ንብረት፣ ሓይሊ ሰራሕተኛን ደገፍን ኣለዉ።', so: 'Jawaabo otomaatig ah kama hawl galaan tijaabadan taageerada. Qalabka hantida, shaqaalaha iyo taageerada ee jira weli waa la heli karaa.', ar: 'الإجابات الآلية غير مفعلة في هذه النسخة التجريبية للدعم. تظل أدوات العقارات والقوى العاملة والدعم الحالية متاحة.', sw: 'Majibu ya kiotomatiki hayajawezeshwa katika jaribio hili la usaidizi. Zana zilizopo za mali, wafanyakazi na usaidizi zinaendelea kupatikana.',
  },
};
for (const [message, translations] of Object.entries(publicSurfaceTranslations)) {
  catalogs.en[message] ??= message;
  for (const [locale, translation] of Object.entries(translations)) catalogs[locale][message] = translation;
}
const localeStorageKey = 'afrolife.locale';
const supportedLocales = Object.keys(localeNames);
const storedLocale = localStorage.getItem(localeStorageKey);
const browserLocale = navigator.languages?.find((language) => supportedLocales.includes(language.split('-')[0]))?.split('-')[0];
let currentLocale = supportedLocales.includes(storedLocale) ? storedLocale : browserLocale ?? 'en';
let onLocaleChange = () => {};
const originalText = new WeakMap();
const originalAttributes = new WeakMap();

export function t(message, values = {}) {
  const translated = catalogs[currentLocale][message] ?? catalogs.en[message] ?? message;
  return translated.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(values[name] ?? ''));
}

export function setLocalizedNodeText(textNode, message, values = {}) {
  originalText.set(textNode, { message, values });
  textNode.nodeValue = t(message, values);
}

export function getLocalizedNodeSource(textNode) {
  return originalText.get(textNode)?.message ?? textNode?.nodeValue ?? '';
}

export function setLocalizedAttribute(element, attribute, message) {
  let sources = originalAttributes.get(element);
  if (!sources) {
    sources = {};
    originalAttributes.set(element, sources);
  }
  sources[attribute] = message;
  element.setAttribute(attribute, t(message));
}

function applyStaticTranslations(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode;
  while ((textNode = walker.nextNode())) {
    const parent = textNode.parentElement;
    if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) continue;
    if (!originalText.has(textNode)) originalText.set(textNode, { message: textNode.nodeValue, values: {} });
    const { message, values } = originalText.get(textNode);
    const trimmed = message.trim();
    if (!trimmed) continue;
    const translation = t(trimmed, values);
    const leading = message.match(/^\s*/)?.[0] ?? '';
    const trailing = message.match(/\s*$/)?.[0] ?? '';
    textNode.nodeValue = `${leading}${translation}${trailing}`;
  }

  root.querySelectorAll('[placeholder], [aria-label], [title]').forEach((element) => {
    let sources = originalAttributes.get(element);
    if (!sources) {
      sources = {};
      originalAttributes.set(element, sources);
    }
    for (const attribute of ['placeholder', 'aria-label', 'title']) {
      if (!element.hasAttribute(attribute)) continue;
      if (!(attribute in sources)) sources[attribute] = element.getAttribute(attribute);
      element.setAttribute(attribute, t(sources[attribute]));
    }
  });
}

export function translateContent(root) {
  applyStaticTranslations(root);
}

export function initializeLocale(onChange) {
  onLocaleChange = onChange;
  const selector = document.querySelector('#language-select');
  selector.value = currentLocale;
  selector.addEventListener('change', () => {
    if (!supportedLocales.includes(selector.value)) return;
    currentLocale = selector.value;
    localStorage.setItem(localeStorageKey, currentLocale);
    document.documentElement.lang = currentLocale;
    document.documentElement.dir = currentLocale === 'ar' ? 'rtl' : 'ltr';
    applyStaticTranslations();
    onLocaleChange(currentLocale);
  });
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = currentLocale === 'ar' ? 'rtl' : 'ltr';
  applyStaticTranslations();
}

export { localeNames };
