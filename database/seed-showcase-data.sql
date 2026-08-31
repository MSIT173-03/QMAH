/*
   QMAH 相容性展示資料補充腳本

   這份腳本保留固定 SQL 展示情境，供無法執行 .NET 資料工具時使用
   本機正式展示若需要更多樣的內容，請優先執行 QmahDatabaseRelease generate-showcase-data
   這份腳本補入社群、遊戲與商城後台開發需要的基本情境資料
   不會新增或修改資料表欄位
   請在已完成 Schema、Identity 與正式文物資料匯入的 QMAH 資料庫執行
   各區段都有防重複條件，可以安全地再次執行
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ShowcaseNow datetime2(3) = CONVERT(datetime2(3), SYSUTCDATETIME());
DECLARE @PrimaryUserId uniqueidentifier =
(
    SELECT TOP (1) [Id]
    FROM [user].[AspNetUsers]
    WHERE [Email] = N'admin@qmah.local'
);

DECLARE @ShowcaseUsers TABLE
(
    [SequenceNo] int NOT NULL PRIMARY KEY,
    [UserId] uniqueidentifier NOT NULL UNIQUE,
    [DisplayName] nvarchar(80) NOT NULL
);

INSERT INTO @ShowcaseUsers ([SequenceNo], [UserId], [DisplayName])
SELECT
    ROW_NUMBER() OVER (ORDER BY u.[Email], u.[Id]),
    u.[Id],
    COALESCE(NULLIF(p.[Nickname], N''), u.[Email])
FROM [user].[AspNetUsers] AS u
LEFT JOIN [user].[UserProfiles] AS p ON p.[UserId] = u.[Id]
WHERE u.[Email] LIKE N'%@qmah.local'
   OR u.[Email] LIKE N'%@qmah.test';

DECLARE @ShowcaseUserCount int = (SELECT COUNT(*) FROM @ShowcaseUsers);
IF @ShowcaseUserCount < 20
    THROW 50001, '請先使用 QmahDatabaseRelease seed-showcase-users 建立至少 20 個展示會員', 1;

IF @PrimaryUserId IS NULL
    SELECT TOP (1) @PrimaryUserId = [UserId] FROM @ShowcaseUsers ORDER BY [SequenceNo];

DECLARE @ShowcaseArtifactCount int = (SELECT COUNT(*) FROM [catalog].[Artifacts]);
IF @ShowcaseArtifactCount = 0
    THROW 50002, '需要先有文物才能建立社群與遊戲展示資料', 1;

BEGIN TRANSACTION;

/* 社群貼文：80 篇不同主題的觀察筆記，並平均分配給展示會員。 */
DECLARE @PostSeeds TABLE
(
    [SeedNo] int NOT NULL PRIMARY KEY,
    [BoardCode] nvarchar(30) NOT NULL,
    [Title] nvarchar(150) NOT NULL,
    [Content] nvarchar(max) NOT NULL,
    [ArtifactSlot] int NULL,
    [PostType] nvarchar(30) NOT NULL DEFAULT N'POST',
    [PublisherType] nvarchar(30) NOT NULL DEFAULT N'COMMUNITY'
);

INSERT INTO @PostSeeds ([SeedNo], [BoardCode], [Title], [Content], [ArtifactSlot])
VALUES
    (1, N'CATALOG', N'青銅觚的腹部轉折要怎麼看', N'我在整理這件青銅觚的資料時，先注意到器口、頸部與腹部收束的比例，再回頭對照紋飾位置。若只看表面圖案，很容易忽略器形本身其實已經提供了不少用途與時代線索。', 1),
    (2, N'CATALOG', N'同一種青花為何會有深淺差', N'不同青花作品放在一起比較時，顏色深淺不一定只和窯口有關，也可能受到顏料濃度、施釉厚薄與燒成氣氛影響。我想把這幾個因素分開記錄，避免看到顏色相近就直接下結論。', 2),
    (3, N'DISCOVERY', N'玉器打磨痕跡與年代判讀', N'這件玉器的邊緣看起來很平順，但放大之後仍能看到細小的磨製方向。我想請教大家在判讀這類痕跡時，通常會先和器形比較，還是先找同時期作品的加工方式？', 3),
    (4, N'REVIEW', N'漆器表面的光澤是保存狀況嗎', N'照片裡的漆面反光很強，第一眼會讓人以為保存得非常完整。不過光線角度、拍攝設備與後續修整都可能改變視覺效果，因此我打算把照片資訊和保存說明分開閱讀，再整理成較保守的觀察。', 4),
    (5, N'REVIEW', N'看畫作留白時我會先注意哪裡', N'以前看山水畫常常只追著山勢與人物移動，最近才發現留白區域也會控制觀看節奏。我會先看空間如何連接，再回頭找題跋、印記與人物活動的位置，這樣比較不容易只記住局部細節。', 5),
    (6, N'CATALOG', N'釉色不均是否一定代表窯口不同', N'幾件器物的釉色都帶有些微深淺變化，但資料來源沒有直接把差異歸因於窯口。除了胎土、釉層和燒成條件之外，光線與長期保存也會影響顏色，我覺得先保留疑問比急著分類更穩妥。', NULL),
    (7, N'DISCOVERY', N'從器足形狀推測使用方式', N'器足的高度與接地面積常常被我放到最後才看，實際比對幾件同類作品後，才發現它會影響器物的穩定性與觀看角度。若再加上器身容量和重量，或許能更接近原本的使用情境。', 7),
    (8, N'CATALOG', N'小件玉飾上的穿孔位置', N'這件玉飾的孔並不在正中央，而是略微偏向一側。除了製作時的取向之外，也可能和懸掛、縫綴或佩戴方式有關；我想再找幾件尺寸接近的作品，比較孔徑與邊緣磨耗是否有共同特徵。', 8),
    (9, N'REVIEW', N'金屬器物的鏽蝕與原始色澤', N'金屬表面的深色區域很容易被當成原本的顏色，但鏽蝕、清理與拍攝光源都會造成差異。閱讀資料時我會把目前可見的表面狀態和推測的原始外觀分開寫，讓筆記保留可以修正的空間。', 9),
    (10, N'REVIEW', N'花鳥畫裡的枝葉層次', N'我注意到畫面前景的枝葉筆觸比較厚，遠處則用較輕的墨色帶過，這種差異讓視線自然落到鳥的位置。若只截取局部看，很難感受到整體安排，所以我會先看完整構圖再討論某一筆的特色。', 10),
    (11, N'CATALOG', N'瓷器底部款識的閱讀順序', N'看底部款識時，我通常會先確認字的位置、排列與書體，再比較同類作品的寫法。款識本身可以提供線索，但不應該單獨決定年代，還是要和器形、胎釉及來源說明一起核對。', 11),
    (12, N'GENERAL', N'看懂文物尺寸欄位的小心得', N'尺寸資料看起來只是幾個數字，實際上可以幫助我們建立器物的比例感。把通高、口徑、腹徑和重量放在一起讀，會比只記住一個高度更容易想像它在手上的大小與使用方式。', 12),
    (13, N'DISCOVERY', N'木雕刀痕留下的製作線索', N'木雕表面有幾段方向一致的刀痕，轉折處則留下較細的修整痕跡。這些細節未必能直接判定作者或年代，但可以協助我們理解製作流程，也能提醒自己不要只用題材名稱替作品下判斷。', 13),
    (14, N'REVIEW', N'同一件器物不同光線下的差異', N'我把同一件器物在不同角度的照片並排看，發現浮雕深度、釉面起伏與修補位置會隨光線變化。這次比較讓我覺得，保存紀錄和影像資料最好一起看，否則很容易把拍攝效果誤認成器物本身的特徵。', NULL),
    (15, N'CATALOG', N'紋飾對稱不代表每一筆都一樣', N'對稱紋樣給人的整體感很整齊，但放大後仍能看到左右筆勢和間距有些不同。這種差異可能和手工製作、模印方式或後續修整有關，我想把相同位置的細節截圖整理起來，再和其他器物比較。', 15),
    (16, N'GENERAL', N'展場說明和圖鑑描述怎麼交叉看', N'展場文字通常很適合快速建立脈絡，圖鑑則會補上尺寸、來源與研究資訊。遇到兩邊用詞不完全相同時，我會先確認它們是否在談不同層次的事情，再把能確定的內容和仍待查證的部分分欄記下來。', 16),
    (17, N'CATALOG', N'從器蓋與器身的接合找用途', N'器蓋和器身的接合處常常能看出開合頻率、密合程度與受力方式。這件作品的邊緣有些磨耗，讓我開始思考它原本是否需要經常取放內容物，而不是只把它當成一件靜態的造型作品。', 17),
    (18, N'DISCOVERY', N'青銅銘文要先看字形還是位置', N'銘文的字形、行款與鑄刻位置都可能提供判讀線索，但不同資料的說明重點並不一致。我目前會先完整抄錄可辨識的內容，再標記缺字與不確定處，最後才和器形及出土地等資訊一起比對。', 18),
    (19, N'CATALOG', N'陶器胎土顏色可以提供哪些線索', N'胎土顏色很受燒成氣氛、表面處理與照片白平衡影響，因此我不會只靠一張圖片判斷產地。若能同時看到斷面、器底和完整尺寸，再搭配來源資料，觀察才比較有機會形成可驗證的假設。', 19),
    (20, N'DISCOVERY', N'玉璧孔徑與比例的觀察', N'比較幾件玉璧時，我發現孔徑和外緣比例會改變作品的視覺重量。這不一定直接對應年代，但可以先作為分類和比較的起點；若再加入厚度、邊緣加工與穿繫痕跡，筆記會更完整。', 20),
    (21, N'REVIEW', N'釉面開片要怎麼寫進觀察筆記', N'開片既是表面效果，也可能和釉胎收縮、燒成條件及後來的保存環境有關。寫筆記時我會描述裂紋的分布、大小與是否貫穿，而不直接把它等同於某個窯口，這樣比較符合目前能看到的證據。', 21),
    (22, N'REVIEW', N'畫面人物比例與時代風格', N'畫中人物的身形、服飾和活動位置會一起影響畫面的時代感，但單一細節容易受到畫家個人習慣干擾。我會先找幾個可以比較的構圖，再把人物比例和題跋、設色以及裝裱資料放在同一份筆記裡。', NULL),
    (23, N'CATALOG', N'漆盒邊角磨損反映的使用痕跡', N'盒蓋邊角的磨痕集中在幾個容易碰撞的位置，和表面整體的光澤變化不太一樣。這讓我想把「製作特徵」「保存痕跡」與「使用痕跡」分開記錄，再確認資料是否有修復或收藏流傳的說明。', 23),
    (24, N'GENERAL', N'文物照片裡的陰影會誤導什麼', N'陰影會讓淺浮雕看起來更深，也可能把器身的自然弧度誤認成裂痕或接縫。現在我會先觀察光源方向，再用多張照片互相印證；如果仍然無法確認，就在筆記裡明確標成待查，而不是補上一個看似完整的答案。', 24),
    (25, N'DISCOVERY', N'從收納方式想像器物原本的用途', N'器物是否適合堆疊、懸掛或放在桌面，往往和它的尺寸、底部結構與邊緣設計有關。這種推測不能取代文獻證據，但能幫助我提出下一個查找方向，也比較容易和同類作品進行有意義的討論。', 25),
    (26, N'REVIEW', N'不確定年代時如何寫得更準確', N'遇到資料只提供大致年代範圍時，我會避免把範圍縮成一個看起來很精準的年份。先說明資料明確指出的部分，再補上器形或材質帶來的可能方向，最後留下來源與疑問，讀者才知道哪些是紀錄、哪些是推論。', 26),
    (27, N'CATALOG', N'青花線條粗細與筆觸速度', N'青花線條有些段落厚重、有些段落很輕，除了筆壓之外，也可能和顏料含水量、繪製速度及燒成後的暈散有關。把線條放大觀察時，我會同時保留完整器物照片，避免局部細節脫離整體構圖。', 27),
    (28, N'DISCOVERY', N'玉石透明度和拍攝光源', N'玉石的透明感很容易受到背光、側光和背景顏色影響，同一件作品在不同照片裡可能呈現完全不同的印象。我想把照片條件和資料欄位一起標記，先描述影像中確定看見的狀態，再討論材質可能帶來的差異。', 28),
    (29, N'CATALOG', N'陶瓷器口沿的修整痕', N'口沿的厚薄、圓整程度和局部修整痕，可以幫助我們理解成形與後續加工的過程。這些痕跡要搭配器身比例一起看才有意義，單獨放大某一段，反而可能把自然的製作差異看成異常。', 29),
    (30, N'REVIEW', N'畫作裝裱邊界能不能當線索', N'裝裱邊界和畫心的比例會影響觀看，也可能反映後來的收藏與修整歷程。不過裝裱不一定和作品創作年代相同，我會把它當作流傳資訊的一部分，和題跋、印記以及保存紀錄分開判讀。', NULL),
    (31, N'CATALOG', N'金工表面細紋的方向', N'金屬表面的細紋有些沿著器身走，有些則集中在轉折與接合位置。這種分布可能和製作、拋磨或長期使用有關，我會先記下方向與位置，再找有相似工藝的作品作為對照，避免過早連結到單一技法。', 31),
    (32, N'GENERAL', N'小型器物與大型器物的比例閱讀', N'把小型器物和大型器物放在同一張圖鑑頁面時，很容易忽略實際尺寸差異。除了看通高，我也會注意口徑、厚度和手持關係，這樣在討論用途或攜帶方式時，描述會比只說「小件」更清楚。', 32),
    (33, N'DISCOVERY', N'從底部支釘痕找燒製方式', N'器底的支釘痕不一定每次都清楚，但只要和足部、釉面缺口及胎土露出處一起看，仍能提出一些燒製上的問題。這類線索需要大量同類作品比較，我先把觀察位置整理成固定格式，方便之後累積資料。', 33),
    (34, N'REVIEW', N'木器接縫如何分辨修補', N'木器接縫處的顏色與紋理變化，可能來自原本的組裝，也可能是後來修補。除了看表面，我會留意接縫是否符合受力方向、兩側木紋是否連續，並把修復紀錄放在旁邊核對，避免只憑照片猜測。', 34),
    (35, N'CATALOG', N'釉色命名和實際看到的顏色', N'資料中的釉色名稱是方便溝通的分類，實際照片則會受光線、螢幕與保存狀態影響。遇到名稱和影像印象不一致時，我會先保留官方欄位，再用自己的文字描述可見色調，兩者不要互相取代。', 35),
    (36, N'GENERAL', N'觀看文物時先讀資料還是先看圖', N'先讀文字可以快速知道背景，先看圖則比較能保留自己的第一印象。我現在會先用短時間看完整影像，記下三個可見細節，再閱讀說明確認哪些觀察有資料支持，這個順序讓筆記比較不容易被先入為主帶走。', 36),
    (37, N'REVIEW', N'紋樣重複的節奏帶來什麼感覺', N'連續紋樣的間距、方向和轉折會影響器物的節奏感，也能反映裝飾如何配合器身曲面。與其只說「很規整」，我會把重複單位、轉角處理和視線停留的位置寫出來，這樣更方便和其他作品比較。', 37),
    (38, N'CATALOG', N'器物重量欄位對使用情境的幫助', N'重量資料可以補足尺寸看不出的手感，但也要先確認是否包含底座、配件或後來的裝裱。把重量和重心、握持位置及器壁厚度一起讀，才比較能討論它是否適合移動、端持或固定陳列。', NULL),
    (39, N'DISCOVERY', N'古畫中的器物可以怎麼輔助判讀', N'畫中的器物未必是精確描繪，但器形、擺放位置和使用情境仍可能提供比較方向。我會先把畫中可見部分和實物圖像分開記錄，再查找相關研究，不把藝術作品裡的表現直接當成器物的尺寸或年代證據。', 39),
    (40, N'REVIEW', N'保存修復紀錄應該注意哪些欄位', N'修復日期、處理範圍、使用材料和前後影像，會影響我們對表面狀態的理解。整理資料時我會把原始狀況、修復後狀況與目前展示狀況分成三段，這樣後續看到裂痕、補色或光澤變化時，比較不會混在一起。', 40),
    (41, N'CATALOG', N'從器身弧度理解握持方式', N'器身弧度和把手、口沿的距離，會改變手部施力與傾倒方向。即使沒有完整的使用文獻，也能先從尺寸、重心與磨耗位置提出問題，再找同類作品和考古資料交叉比對，讓推測有清楚的來由。', 41),
    (42, N'GENERAL', N'文物年代欄位的範圍怎麼閱讀', N'年代欄位有時是朝代，有時會細到某個時期或世紀，不能把不同精度的資料當成同一種答案。我的做法是保留原始寫法，另外記錄可以比較的起訖範圍，閱讀不同資料來源時才不會誤以為精度完全一致。', 42),
    (43, N'DISCOVERY', N'比較同類文物時我會做的三個記號', N'我通常先記器形比例，再記表面工藝，最後記來源與保存狀況，三項分開看比較容易找到差異。若把所有印象混成一句話，之後回頭比較時很難知道差異究竟來自製作、年代，還是照片與保存條件。', 43),
    (44, N'GENERAL', N'圖鑑來源與授權標示的差別', N'來源網址回答資料從哪裡來，授權標示則說明影像或文字可以如何使用，兩者在整理資料時都不能省略。這次匯入資料我特別把原始網址、授權代碼與出處文字分開留存，日後前台展示時才不會把它們混成一個模糊的欄位。', 44),
    (45, N'CATALOG', N'對照不同類別資料時的分類困惑', N'同一件作品可能同時具有材質、用途與工藝等不同描述，但資料庫分類需要選定主要類別。遇到邊界案例時，我會先依來源資料的正式分類匯入，再把其他描述留在說明文字裡，避免為了讓清單整齊而自行改寫原始資訊。', NULL),
    (46, N'REVIEW', N'看見熟悉紋樣後如何避免先入為主', N'看到熟悉紋樣時，很容易立刻聯想到某個朝代或用途。我現在會先把可見形狀、位置和比例記下來，等查完來源與同類作品後再補充解釋，刻意把第一印象和查證結果分開，反而更能看出自己原本忽略了什麼。', 46),
    (47, N'DISCOVERY', N'一件文物適合拆成哪些觀察問題', N'我會把一件文物拆成器形、材質、紋飾、尺寸、來源與保存六個方向，再依資料完整程度調整問題。這樣做不是要把作品切碎，而是讓每個判斷都有對應線索，之後和其他會員交流時也比較容易指出彼此討論的是哪一部分。', 47),
    (48, N'GENERAL', N'整理圖鑑時最意外的發現', N'這次整理資料最意外的是，原本以為最醒目的紋飾，未必是區分同類作品最有效的線索。器底、尺寸和來源欄位反而常常能補上關鍵脈絡，讓我開始重新安排自己的閱讀順序，也更重視每個看似普通的資料欄位。', 48);

/* 第二批貼文補足分類、官方公告與長期趨勢；內容刻意保留可討論的觀察，不用重複測試字樣。 */
INSERT INTO @PostSeeds
    ([SeedNo], [BoardCode], [Title], [Content], [ArtifactSlot], [PostType], [PublisherType])
VALUES
    (49, N'CATALOG', N'青銅器耳部的鑄造痕跡', N'器身兩側的耳部看起來對稱，但接近器身的位置仍有些微厚薄差。我想先確認這是鑄造時的結構需求，還是後續修整留下的變化，再和同類器物的耳部比例一起比較，避免只從正面影像下結論。', 49, N'POST', N'COMMUNITY'),
    (50, N'DISCOVERY', N'把文物資料整理成時間線', N'我把取得來源、修復紀錄、研究發表與目前展示狀態排成一條時間線後，才發現同一件作品的不同日期各自代表不同事件。這樣整理可以避免把入藏時間誤當成創作時間，也讓後續查證時知道應該先找哪一段資料。', 50, N'POST', N'COMMUNITY'),
    (51, N'QUESTION', N'缺少出土地資訊時怎麼描述', N'有些資料只有收藏來源，沒有完整的出土地或流傳紀錄。遇到這種情況，我會直接寫明目前知道的範圍，不用推測補滿空白；但也想請教大家，哪些欄位最適合拿來標記後續可能找到的線索，讓資料不會被誤讀成完整記錄？', NULL, N'POST', N'COMMUNITY'),
    (52, N'GUIDE', N'我為每件文物保留哪些查證欄位', N'目前整理時會另外保留來源標題、原始網址、查閱日期與資料版本，並把自己的摘要和來源原文分開。這些欄位不一定會全部顯示在前台，但之後如果發現描述需要修正，可以比較快回到原始脈絡，不必重新猜測當時的依據。', 52, N'POST', N'COMMUNITY'),
    (53, N'REVIEW', N'小幅畫作的視線入口', N'小幅畫作的畫面很緊湊，我會先找最亮或最深的區域，再沿著人物動勢和枝葉方向移動視線。這種觀看順序未必是畫家原本的安排，但把自己的視線路徑記下來，能幫助我更具體地討論構圖如何引導觀看。', 53, N'POST', N'COMMUNITY'),
    (54, N'CATALOG', N'器身比例和容量估算', N'同樣的高度不代表實際容量相近，口徑、腹部寬度與器壁厚度都會改變結果。我先把可量到的尺寸列出，再用保守語氣討論可能的使用情境，這樣即使沒有原始容量紀錄，也不會把估算誤寫成正式資料。', 54, N'POST', N'COMMUNITY'),
    (55, N'DISCOVERY', N'玉器邊緣的崩口要怎麼記錄', N'邊緣的小崩口在縮圖裡不容易看見，放大後則要分辨是使用痕跡、保存碰撞還是拍攝陰影。我的做法是先記位置、大小與是否露出內層，再對照保存說明；如果沒有足夠影像，就把判斷停在可見狀態。', 55, N'POST', N'COMMUNITY'),
    (56, N'GENERAL', N'資料來源相同不代表版本相同', N'兩筆資料都標示同一個來源網站，但標題、更新日期和影像版本可能不一致。整理時我會把查閱時間與頁面版本留在備註，並確認是否真的描述同一件作品，避免因為來源名稱相同就把不同紀錄直接合併。', 56, N'POST', N'COMMUNITY'),
    (57, N'QUESTION', N'照片只有正面時能判讀到什麼', N'只有正面照片時，紋飾和大致構圖通常還能描述，但器底、背面、厚度與接合方式都無法確認。我會把能看見和不能看見的部分分開列出，再決定是否需要補圖；想知道大家在資料不足時，會優先要求哪一個角度？', NULL, N'POST', N'COMMUNITY'),
    (58, N'GUIDE', N'整理筆記時如何區分觀察與推論', N'我現在會用「照片中可見」「資料明確指出」和「目前推測」三個段落整理文字。這樣寫雖然比一句話更長，但讀者能知道每個判斷的根據，也方便日後有新資料時只修正推論，不必把整篇筆記重新拆開。', 58, N'POST', N'COMMUNITY'),
    (59, N'REVIEW', N'書畫紙色變化和燈光', N'書畫的紙色會受到展場燈光、攝影白平衡與保存環境影響，不能只用照片中的冷暖色判斷年代。比較時我會先看同一組影像的背景與光線，再對照材質描述，讓色彩觀察保留足夠的條件說明。', 59, N'POST', N'COMMUNITY'),
    (60, N'GENERAL', N'本月文物觀察主題：從器底開始', N'本月社群觀察主題聚焦在器底、足部與接地面。歡迎大家選一件有興趣的文物，先記錄可見的結構與磨耗，再分享自己想查證的問題；這不是鑑定結論活動，而是希望讓比較有清楚的起點。', NULL, N'ANNOUNCEMENT', N'OFFICIAL'),
    (61, N'CATALOG', N'陶器圈足的施釉界線', N'圈足附近的露胎與釉面交界，常常比器身中央更能看出成形和施釉的順序。這件作品的界線並不完全平均，我想先確認是否和放置方式、燒製支點或後來磨耗有關，再拿同類作品作對照。', 61, N'POST', N'COMMUNITY'),
    (62, N'DISCOVERY', N'印記位置與裝裱變動', N'印記看似固定在畫面的一部分，但重新裝裱後，邊界和留白比例都可能改變。整理時我會先記錄印記相對於畫心的位置，再另外描述裝裱狀態，避免把後來的邊界誤當成創作時的構圖安排。', 62, N'POST', N'COMMUNITY'),
    (63, N'QUESTION', N'同類作品尺寸差距很大怎麼比', N'比較同類作品時，如果只按高度排序，常常會忽略口徑、厚度與用途差異。我想把尺寸轉成幾個簡單比例，再加入材質和保存狀態作為備註；如果大家有更適合小型資料集的比較方式，也很想拿來試著整理看看。', 63, N'POST', N'COMMUNITY'),
    (64, N'GUIDE', N'圖鑑搜尋關鍵字怎麼設計', N'我會把正式名稱、常見別名、材質、工藝和用途拆成不同關鍵字，並保留原始名稱作為主要標題。這樣使用者可以用熟悉的詞找到資料，管理者也不會因為為了搜尋方便而改掉來源的正式寫法。', NULL, N'POST', N'COMMUNITY'),
    (65, N'REVIEW', N'器物表面修補與展示燈光', N'修補區在正面光線下可能幾乎看不見，換成側光後反而會出現不同的起伏。這提醒我看保存紀錄時不能只對照一張展示照片，最好把光線條件和修補範圍一起記錄，才能知道影像差異從哪裡來。', 65, N'POST', N'COMMUNITY'),
    (66, N'CATALOG', N'金屬接縫的受力方向', N'接縫的位置不只反映製作方式，也可能和器物長期承受的重量有關。我會先觀察接縫是否沿著受力方向延伸，再對照器身厚度與支撐位置；目前只能提出結構上的問題，還不能直接判定使用歷史。', 66, N'POST', N'COMMUNITY'),
    (67, N'GENERAL', N'把收藏履歷和研究履歷分開', N'入藏、借展、修復與研究發表常常出現在同一份說明裡，但它們回答的是不同問題。我把收藏履歷和研究履歷分開整理後，時間關係變得清楚很多，也比較不會把某次研究的描述誤當成作品原本的狀態。', 67, N'POST', N'COMMUNITY'),
    (68, N'DISCOVERY', N'從保存環境理解顏色變化', N'同一種材質在乾燥、潮濕或光照不同的環境裡，表面顏色可能逐漸改變。這次整理我先記錄資料提供的保存條件，再比較照片中不同區域的差異；如果沒有環境紀錄，就不把顏色變化直接歸因於年代。', 68, N'POST', N'COMMUNITY'),
    (69, N'QUESTION', N'只找到相似圖像能不能下結論', N'相似圖像很適合拿來提出比較方向，但不一定足以確認同一件作品或同一個製作來源。我會把相似之處和不同之處並列，再確認尺寸、來源與影像角度；想請教大家在建立對照組時，最常先排除哪種誤差？', NULL, N'POST', N'COMMUNITY'),
    (70, N'GUIDE', N'我會如何記錄一張參考照片', N'除了檔名，我會記錄照片來源、拍攝或取得日期、觀看角度、光線條件與它支援的觀察問題。這些資訊讓照片不只是裝飾，而是可以被重新檢查的參考；如果照片授權不明，也會先限制在後台資料整理用途。', 70, N'POST', N'COMMUNITY'),
    (71, N'REVIEW', N'題跋和畫面構圖的時間差', N'題跋可能是在作品完成後很久才加上，不能只因為它出現在畫面裡就和創作時間視為同一件事。我會先分別描述畫面、題跋內容與書寫位置，再找來源說明彼此的時間關係，讓判讀保留必要的層次。', 71, N'POST', N'COMMUNITY'),
    (72, N'GENERAL', N'社群資料整理公告與提問方式', N'後台近期會持續整理社群貼文的分類、文物連結與圖片狀態。若發現資料需要補充，請在貼文內清楚寫出對應作品、可見線索與參考來源；我們會依資料內容處理，不用猜測或沒有根據的確定語氣代替查證。', NULL, N'ANNOUNCEMENT', N'OFFICIAL'),
    (73, N'CATALOG', N'物件編號與來源編號如何對照', N'圖鑑編號是平台內的穩定識別，來源編號則可能隨資料庫或館方系統不同而改變。整理時我會把兩者放在不同欄位，並保留對照說明，避免為了讓畫面簡短而把外部編號誤當成平台自己的資料。', 73, N'POST', N'COMMUNITY'),
    (74, N'DISCOVERY', N'材質欄位只有統稱時怎麼補充', N'資料只寫「陶」或「金屬」時，我不會直接自行細分成更精確的材質，而是把影像中能看到的表面狀態放在觀察欄。等找到來源有明確說明，再把正式資訊補上，這樣資料的精度不會超過證據能支持的範圍。', 74, N'POST', N'COMMUNITY'),
    (75, N'QUESTION', N'怎麼把比較結果寫成可驗證的句子', N'我發現「看起來比較古老」很難讓別人回頭檢查，所以會改寫成「器足高度較低、邊緣磨耗集中在某一側」這種可以指回照片的描述。若再補上比較對象和資料來源，其他人就能針對同一個觀察提出不同解釋。', 75, N'POST', N'COMMUNITY'),
    (76, N'GUIDE', N'把展示說明拆成讀者看得懂的層次', N'我會先保留一句能快速理解的摘要，再補上材質、尺寸、來源與保存等細節，最後標記仍待查證的地方。這種分層讓第一次接觸的人不會被欄位淹沒，也讓熟悉文物的人能繼續往下查看依據。', NULL, N'POST', N'COMMUNITY'),
    (77, N'REVIEW', N'展櫃玻璃反光對照片的影響', N'玻璃反光會讓表面出現不屬於器物的亮帶，特別容易干擾判斷釉面起伏和裂痕。看到這種影像時，我會先標記反光區，再找沒有反光的角度或文字紀錄交叉確認，不把拍攝限制寫成作品特徵。', 77, N'POST', N'COMMUNITY'),
    (78, N'CATALOG', N'器口缺損和後來修復的差別', N'器口不完整時，缺損邊緣的顏色、斷面與連續性都值得記錄。若修復材料填回缺口，照片裡可能只看到平整輪廓，這時需要搭配修復紀錄才能判斷；我會把目前影像狀態和歷史處理分成兩段描述。', 78, N'POST', N'COMMUNITY'),
    (79, N'DISCOVERY', N'文物描述要保留哪些不確定性', N'資料整理不一定要把每個欄位寫成完整答案，尤其是年代、來源和用途都可能還在研究中。我會把不確定的原因一起寫出來，例如影像不足或來源沒有提供，讓讀者知道這是待查而不是遺漏，也方便日後接續補充。', 79, N'POST', N'COMMUNITY'),
    (80, N'GENERAL', N'整理完成後我會再檢查哪三件事', N'我通常最後檢查三件事：來源是否可以回查、文物連結是否指向正確作品、描述中的確定語氣是否超過資料支持的範圍。這三項看起來很基本，卻能避免展示頁面把整理過程中的暫時推測誤呈現成正式結論。', NULL, N'POST', N'COMMUNITY');

DECLARE @PostMap TABLE
(
    [SeedNo] int NOT NULL PRIMARY KEY,
    [PostId] uniqueidentifier NOT NULL UNIQUE
);

INSERT INTO @PostMap ([SeedNo], [PostId])
SELECT seed.[SeedNo],
       (
           SELECT TOP (1) post.[Id]
           FROM [social].[SocialPosts] AS post
           WHERE post.[Title] = seed.[Title]
           ORDER BY post.[CreatedAt], post.[Id]
       )
FROM @PostSeeds AS seed
WHERE EXISTS (SELECT 1 FROM [social].[SocialPosts] AS post WHERE post.[Title] = seed.[Title]);

/* 將舊版只有序號的社群資料轉成正式標題，保留既有主鍵，避免重複建立。 */
;WITH LegacyPosts AS
(
    SELECT post.[Id], ROW_NUMBER() OVER (ORDER BY post.[CreatedAt], post.[Id]) AS [LegacyNo]
    FROM [social].[SocialPosts] AS post
    WHERE post.[Title] LIKE N'文物觀察｜第 % 則討論'
      AND NOT EXISTS (SELECT 1 FROM @PostMap AS mapped WHERE mapped.[PostId] = post.[Id])
), MissingSeeds AS
(
    SELECT seed.[SeedNo], ROW_NUMBER() OVER (ORDER BY seed.[SeedNo]) AS [MissingNo]
    FROM @PostSeeds AS seed
    WHERE NOT EXISTS (SELECT 1 FROM @PostMap AS mapped WHERE mapped.[SeedNo] = seed.[SeedNo])
)
UPDATE post
SET post.[BoardCode] = seed.[BoardCode],
    post.[UserId] = member.[UserId],
    post.[ArtifactId] = CASE WHEN seed.[ArtifactSlot] IS NULL THEN NULL ELSE artifact.[Id] END,
    post.[PostType] = seed.[PostType],
    post.[PublisherType] = seed.[PublisherType],
    post.[Title] = seed.[Title],
    post.[Content] = seed.[Content],
    post.[Status] = CASE WHEN seed.[SeedNo] IN (11, 26, 41, 58, 73) THEN N'HIDDEN'
                         WHEN seed.[SeedNo] IN (19, 44, 67) THEN N'DELETED'
                         ELSE N'PUBLISHED' END,
    post.[UpdatedAt] = @ShowcaseNow
FROM [social].[SocialPosts] AS post
INNER JOIN LegacyPosts AS legacy ON legacy.[Id] = post.[Id]
INNER JOIN MissingSeeds AS missing ON missing.[MissingNo] = legacy.[LegacyNo]
INNER JOIN @PostSeeds AS seed ON seed.[SeedNo] = missing.[SeedNo]
INNER JOIN @ShowcaseUsers AS member ON member.[SequenceNo] = ((seed.[SeedNo] - 1) % @ShowcaseUserCount) + 1
OUTER APPLY
(
    SELECT [Id]
    FROM [catalog].[Artifacts]
    ORDER BY [Id]
    OFFSET ((COALESCE(seed.[ArtifactSlot], 1) - 1) % @ShowcaseArtifactCount) ROWS FETCH NEXT 1 ROW ONLY
) AS artifact;

INSERT INTO @PostMap ([SeedNo], [PostId])
SELECT seed.[SeedNo], post.[Id]
FROM @PostSeeds AS seed
INNER JOIN [social].[SocialPosts] AS post ON post.[Title] = seed.[Title]
WHERE NOT EXISTS (SELECT 1 FROM @PostMap AS mapped WHERE mapped.[SeedNo] = seed.[SeedNo]);

INSERT INTO [social].[SocialPosts]
(
    [Id], [BoardCode], [UserId], [ArtifactId], [EventId], [PostType], [PublisherType], [ContentMode], [Title], [Content],
    [Status], [CreatedAt], [UpdatedAt]
)
SELECT
    NEWID(), seed.[BoardCode], member.[UserId],
    CASE WHEN seed.[ArtifactSlot] IS NULL THEN NULL ELSE artifact.[Id] END,
    NULL, seed.[PostType], seed.[PublisherType], N'CUSTOM', seed.[Title], seed.[Content],
    CASE WHEN seed.[SeedNo] IN (11, 26, 41, 58, 73) THEN N'HIDDEN'
         WHEN seed.[SeedNo] IN (19, 44, 67) THEN N'DELETED'
         ELSE N'PUBLISHED' END,
     DATEADD(DAY, -(seed.[SeedNo] * 6 + (seed.[SeedNo] % 4)), @ShowcaseNow),
     DATEADD(MINUTE, 12, DATEADD(DAY, -(seed.[SeedNo] * 6 + (seed.[SeedNo] % 4)), @ShowcaseNow))
FROM @PostSeeds AS seed
INNER JOIN @ShowcaseUsers AS member ON member.[SequenceNo] = ((seed.[SeedNo] - 1) % @ShowcaseUserCount) + 1
OUTER APPLY
(
    SELECT [Id]
    FROM [catalog].[Artifacts]
    ORDER BY [Id]
    OFFSET ((COALESCE(seed.[ArtifactSlot], 1) - 1) % @ShowcaseArtifactCount) ROWS FETCH NEXT 1 ROW ONLY
) AS artifact
WHERE NOT EXISTS (SELECT 1 FROM @PostMap AS mapped WHERE mapped.[SeedNo] = seed.[SeedNo]);

INSERT INTO @PostMap ([SeedNo], [PostId])
SELECT seed.[SeedNo], post.[Id]
FROM @PostSeeds AS seed
INNER JOIN [social].[SocialPosts] AS post ON post.[Title] = seed.[Title]
WHERE NOT EXISTS (SELECT 1 FROM @PostMap AS mapped WHERE mapped.[SeedNo] = seed.[SeedNo]);

/* 留言內容採多組自然語句，每篇至少兩筆；舊版留言會保留主鍵並更新成可讀內容。 */
DECLARE @CommentPhrases TABLE
(
    [PhraseNo] int NOT NULL PRIMARY KEY,
    [Content] nvarchar(2000) NOT NULL
);

INSERT INTO @CommentPhrases ([PhraseNo], [Content])
VALUES
    (1, N'我也會先看器形的轉折，再回頭對照紋飾位置。把兩個觀察分開記錄之後，確實比較不容易因為熟悉的圖案就直接聯想到某個年代。'),
    (2, N'這個角度很有幫助，我以前常把照片裡的光影當成表面特徵。若能再補一張側光或器底影像，應該更容易確認目前看到的起伏是不是製作痕跡。'),
    (3, N'我查到的同類作品也有類似比例，但口沿和器足的差異滿明顯。或許可以把尺寸與材質一起整理，單看其中一項可能會漏掉真正有用的線索。'),
    (4, N'讀到這段時我想到保存狀況也會影響判讀，尤其是顏色與光澤。把官方描述、照片條件和自己的觀察分開，之後修正筆記會方便很多。'),
    (5, N'我喜歡你把確定資料和推測分開寫，這樣其他人比較容易接著查證。文物討論不一定要馬上得到唯一答案，留下推論依據反而更有交流價值。'),
    (6, N'如果要比較同類作品，我會再加上器底和接合處的照片。正面看起來很接近的作品，常常在這些不顯眼的位置出現製作或修整上的差別。'),
    (7, N'這件作品的比例讓我想到原本的使用姿勢，尤其是握持位置和重心的關係。即使沒有文獻可以直接證明，也可以先把問題整理成之後查資料的方向。'),
    (8, N'資料欄位看起來普通，但尺寸、重量與來源放在一起時，會突然補上很多脈絡。我最近也開始把這些欄位一起讀，不再只挑自己熟悉的紋飾。'),
    (9, N'我會把這個細節放大後和完整器物照片並排，避免局部看得太清楚反而失去比例。尤其是小件作品，邊緣的一點變化在全圖裡可能完全不同。'),
    (10, N'這個判讀保留得很剛好，沒有把影像上的印象寫成確定結論。若後續找到研究資料，再回頭補上來源與差異，整份觀察就會更有說服力。'),
    (11, N'我之前也遇過來源文字和照片印象不完全一致的情況，後來發現兩者描述的層次不同。先確認每個欄位的用途，再比較內容會清楚很多。'),
    (12, N'從器底開始看是很實用的方法，因為那裡常留下成形、燒製或後來修整的痕跡。若能和同一類別的幾件作品放在一起，應該可以看出更穩定的模式。'),
    (13, N'這段讓我重新注意到照片條件，背光和側光對透明度、凹凸深度的影響真的很大。以後整理資料時，我也會順手記下影像是否有提供拍攝方向。'),
    (14, N'我會把「看起來像」改寫成「目前可見」或「可能與……有關」，這樣讀者比較知道哪些是觀察、哪些是解釋。這種文字上的區分對資料整理很重要。'),
    (15, N'同一個紋樣在平面和曲面上的排列方式不太一樣，轉角位置尤其值得看。若只截取平整區域，可能會錯過製作者如何處理連續圖案的細節。'),
    (16, N'這個主題很適合拿來做前後對照，我會先列出三個可以直接看見的差異，再查資料解釋原因。先有明確比較基準，討論時比較不會停留在感覺。'),
    (17, N'我覺得把保存、修復與使用痕跡分開是關鍵，三者在照片裡有時很像。若資料沒有明確說明，我會先保留描述，不急著替痕跡命名。'),
    (18, N'這個觀察也提醒我不要只依賴單一欄位。年代、分類與來源彼此可以互相校對，但任何一項都不應該脫離完整資料單獨決定答案。'),
    (19, N'我在整理自己的筆記時會保留原始用詞，再加一欄比較容易理解的說明。這樣既不會改動來源內容，也能讓之後閱讀的人快速知道我當時看見了什麼。'),
    (20, N'如果之後要做成題目，我會把這個細節改寫成需要比較的線索，而不是直接問年代。讓玩家先觀察證據，再選擇最合理的說法，應該會更接近實際判讀。'),
    (21, N'這件作品的資訊量很適合慢慢拆開看，先處理形制，再補上工藝與流傳。一次把所有推測塞在一起，反而容易讓重要的來源線索被淹沒。'),
    (22, N'我同意先留下疑問，因為同類作品之間的差異常常比想像中複雜。只要記清楚使用了哪些照片和資料，之後找到新證據時就能回頭修正。'),
    (23, N'這個比較方式很適合建立長期的觀察紀錄，尤其是把尺寸、材質與表面狀態固定成相同順序。累積幾次之後，應該會比零散印象更容易找到規律。'),
    (24, N'我以前會先被最醒目的顏色或紋樣吸引，現在則會刻意從器底、邊緣和來源欄位開始。這樣看雖然慢一點，但比較能發現原本忽略的線索。');

DECLARE @CommentPhraseCount int = (SELECT COUNT(*) FROM @CommentPhrases);

;WITH ExistingComments AS
(
    SELECT
        comment.[Id],
        mapped.[SeedNo],
        ROW_NUMBER() OVER (ORDER BY mapped.[SeedNo], comment.[CreatedAt], comment.[Id]) AS [SequenceNo]
    FROM [social].[SocialComments] AS comment
    INNER JOIN @PostMap AS mapped ON mapped.[PostId] = comment.[PostId]
)
UPDATE comment
SET comment.[UserId] = member.[UserId],
    comment.[Content] = phrase.[Content],
     comment.[Status] = CASE WHEN existing.[SequenceNo] % 29 = 0 THEN N'HIDDEN'
                             WHEN existing.[SequenceNo] % 43 = 0 THEN N'DELETED'
                             ELSE N'PUBLISHED' END,
     comment.[CreatedAt] = DATEADD(MINUTE, 12 + (existing.[SequenceNo] % 37), DATEADD(DAY, -(existing.[SeedNo] * 6 + (existing.[SeedNo] % 4)), @ShowcaseNow)),
     comment.[UpdatedAt] = @ShowcaseNow
FROM [social].[SocialComments] AS comment
INNER JOIN ExistingComments AS existing ON existing.[Id] = comment.[Id]
INNER JOIN @CommentPhrases AS phrase ON phrase.[PhraseNo] = ((existing.[SequenceNo] - 1) % @CommentPhraseCount) + 1
INNER JOIN @ShowcaseUsers AS member ON member.[SequenceNo] = ((existing.[SequenceNo] - 1) % @ShowcaseUserCount) + 1;

DECLARE @CommentSlots TABLE ([SlotNo] int NOT NULL PRIMARY KEY);
INSERT INTO @CommentSlots ([SlotNo]) VALUES (1), (2);

;WITH CommentCounts AS
(
    SELECT mapped.[SeedNo], mapped.[PostId], COUNT(comment.[Id]) AS [CommentCount]
    FROM @PostMap AS mapped
    LEFT JOIN [social].[SocialComments] AS comment ON comment.[PostId] = mapped.[PostId]
    GROUP BY mapped.[SeedNo], mapped.[PostId]
), MissingComments AS
(
    SELECT counts.[SeedNo], counts.[PostId], counts.[CommentCount], slots.[SlotNo]
    FROM CommentCounts AS counts
    CROSS JOIN @CommentSlots AS slots
    WHERE slots.[SlotNo] > counts.[CommentCount]
)
INSERT INTO [social].[SocialComments]
(
    [Id], [PostId], [ParentCommentId], [UserId], [Content],
    [Status], [CreatedAt], [UpdatedAt]
)
SELECT
    NEWID(), missing.[PostId], NULL, member.[UserId], phrase.[Content],
    CASE WHEN (missing.[SeedNo] + missing.[SlotNo]) % 17 = 0 THEN N'HIDDEN' ELSE N'PUBLISHED' END,
     DATEADD(MINUTE, 12 + (missing.[SlotNo] * 9), DATEADD(DAY, -(missing.[SeedNo] * 6 + (missing.[SeedNo] % 4)), @ShowcaseNow)),
     DATEADD(MINUTE, 12 + (missing.[SlotNo] * 9), DATEADD(DAY, -(missing.[SeedNo] * 6 + (missing.[SeedNo] % 4)), @ShowcaseNow))
FROM MissingComments AS missing
INNER JOIN @CommentPhrases AS phrase ON phrase.[PhraseNo] = ((missing.[SeedNo] + missing.[SlotNo] - 1) % @CommentPhraseCount) + 1
INNER JOIN @ShowcaseUsers AS member ON member.[SequenceNo] = ((missing.[SeedNo] + missing.[SlotNo] - 2) % @ShowcaseUserCount) + 1;

/* 遊戲房間與玩家 */
DECLARE @RoomSeeds TABLE
(
    [RoomCode] nvarchar(12) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [Visibility] nvarchar(10) NOT NULL,
    [MaxPlayers] tinyint NOT NULL,
    [TotalRounds] tinyint NOT NULL,
    [CurrentRoundNo] tinyint NOT NULL,
    [CreatedDaysAgo] int NOT NULL,
    [HostUserSequence] int NOT NULL,
    [PlayerUserSequence] int NOT NULL
);

INSERT INTO @RoomSeeds
    ([RoomCode], [Status], [Visibility], [MaxPlayers], [TotalRounds], [CurrentRoundNo], [CreatedDaysAgo], [HostUserSequence], [PlayerUserSequence])
VALUES
    (N'SHOW301', N'WAITING',   N'PUBLIC',  6, 3, 0, 0,   1, 2),
    (N'SHOW302', N'WAITING',   N'PUBLIC',  4, 2, 0, 18,  3, 5),
    (N'SHOW303', N'PLAYING',   N'PUBLIC',  6, 3, 3, 0,   4, 6),
    (N'SHOW304', N'PLAYING',   N'PUBLIC',  8, 5, 5, 1,   7, 8),
    (N'SHOW305', N'COMPLETED', N'PUBLIC',  4, 3, 3, 119, 9, 10),
    (N'SHOW306', N'COMPLETED', N'PUBLIC',  6, 2, 2, 164, 11, 12),
    (N'SHOW307', N'CANCELLED', N'PUBLIC',  5, 3, 3, 221, 14, 15),
    (N'SHOW308', N'CANCELLED', N'PUBLIC',  6, 4, 4, 286, 16, 17);

INSERT INTO [game].[GameRooms]
(
    [Id], [RoomCode], [Status], [Visibility], [PasswordHash], [MaxPlayers],
    [TotalRounds], [AnswerSeconds], [VotingSeconds], [CategoryFilterCode],
    [EraBucketFilterCode], [CurrentRoundNo], [StateVersion], [CreatedAt],
    [StartedAt], [EndedAt], [CompletedAt]
)
SELECT
    NEWID(),
    seed.[RoomCode],
    seed.[Status],
    seed.[Visibility],
    NULL,
    seed.[MaxPlayers],
    seed.[TotalRounds],
    120,
    60,
    NULL,
    NULL,
    seed.[CurrentRoundNo],
    CASE WHEN seed.[Status] = N'WAITING' THEN 0 ELSE seed.[CurrentRoundNo] + 1 END,
    DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME()),
    CASE WHEN seed.[Status] = N'WAITING' THEN NULL
         ELSE DATEADD(MINUTE, 5, DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME())) END,
    CASE WHEN seed.[Status] IN (N'COMPLETED', N'CANCELLED')
         THEN DATEADD(MINUTE, 35, DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME()))
         ELSE NULL END,
    CASE WHEN seed.[Status] IN (N'COMPLETED', N'CANCELLED')
         THEN DATEADD(MINUTE, 35, DATEADD(DAY, -seed.[CreatedDaysAgo], SYSUTCDATETIME()))
         ELSE NULL END
FROM @RoomSeeds AS seed
WHERE NOT EXISTS
(
    SELECT 1
    FROM [game].[GameRooms] AS existing
    WHERE existing.[RoomCode] = seed.[RoomCode]
);

DECLARE @SeedRoomCode nvarchar(12);
DECLARE @SeedRoomStatus nvarchar(20);
DECLARE @SeedRoomId uniqueidentifier;
DECLARE @SeedRoomCreatedAt datetime2(3);
DECLARE @SeedRoomSequence int;
DECLARE @SeedRoomHostSequence int;
DECLARE @SeedRoomPlayerSequence int;
DECLARE @SeedRoomHostUserId uniqueidentifier;
DECLARE @SeedRoomPlayerUserId uniqueidentifier;
DECLARE @SeedRoomHostName nvarchar(80);
DECLARE @SeedRoomPlayerName nvarchar(80);

DECLARE room_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT room.[RoomCode], room.[Status], room.[Id], room.[CreatedAt],
           ROW_NUMBER() OVER (ORDER BY room.[RoomCode]),
           seed.[HostUserSequence], seed.[PlayerUserSequence]
    FROM [game].[GameRooms] AS room
    INNER JOIN @RoomSeeds AS seed ON seed.[RoomCode] = room.[RoomCode]
    WHERE room.[RoomCode] IN (SELECT [RoomCode] FROM @RoomSeeds)
    ORDER BY room.[RoomCode];

OPEN room_cursor;
FETCH NEXT FROM room_cursor INTO @SeedRoomCode, @SeedRoomStatus, @SeedRoomId, @SeedRoomCreatedAt, @SeedRoomSequence, @SeedRoomHostSequence, @SeedRoomPlayerSequence;

WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @SeedRoomHostUserId = [UserId], @SeedRoomHostName = [DisplayName]
    FROM @ShowcaseUsers
    WHERE [SequenceNo] = @SeedRoomHostSequence;
    SELECT @SeedRoomPlayerUserId = [UserId], @SeedRoomPlayerName = [DisplayName]
    FROM @ShowcaseUsers
    WHERE [SequenceNo] = @SeedRoomPlayerSequence;

    UPDATE player
    SET player.[UserId] = @SeedRoomHostUserId,
        player.[DisplayName] = @SeedRoomHostName
    FROM [game].[GamePlayers] AS player
    WHERE player.[RoomId] = @SeedRoomId
      AND player.[PlayerKey] = CONCAT(N'host-', @SeedRoomCode);

    UPDATE player
    SET player.[UserId] = @SeedRoomPlayerUserId,
        player.[DisplayName] = @SeedRoomPlayerName
    FROM [game].[GamePlayers] AS player
    WHERE player.[RoomId] = @SeedRoomId
      AND player.[PlayerKey] = CONCAT(N'player-', @SeedRoomCode);

    IF NOT EXISTS
    (
        SELECT 1 FROM [game].[GamePlayers]
        WHERE [RoomId] = @SeedRoomId AND [PlayerKey] = CONCAT(N'host-', @SeedRoomCode)
    )
    BEGIN
        INSERT INTO [game].[GamePlayers]
        (
            [Id], [RoomId], [UserId], [PlayerKey], [DisplayName], [Role], [IsReady], [SeatNo],
            [JoinedAt], [ConnectionStatus], [LastSeenAt], [DisconnectedAt], [ReconnectDeadlineAt], [LeftAt]
        )
        VALUES
        (
            NEWID(), @SeedRoomId, @SeedRoomHostUserId, CONCAT(N'host-', @SeedRoomCode), @SeedRoomHostName, N'HOST', 1, 1,
            DATEADD(MINUTE, 2, @SeedRoomCreatedAt),
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED') THEN N'LEFT' ELSE N'ONLINE' END,
            DATEADD(MINUTE, 30, @SeedRoomCreatedAt),
            NULL,
            NULL,
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED')
                 THEN DATEADD(MINUTE, 30, @SeedRoomCreatedAt) ELSE NULL END
        );
    END;

    IF NOT EXISTS
    (
        SELECT 1 FROM [game].[GamePlayers]
        WHERE [RoomId] = @SeedRoomId AND [PlayerKey] = CONCAT(N'player-', @SeedRoomCode)
    )
    BEGIN
        INSERT INTO [game].[GamePlayers]
        (
            [Id], [RoomId], [UserId], [PlayerKey], [DisplayName], [Role], [IsReady], [SeatNo],
            [JoinedAt], [ConnectionStatus], [LastSeenAt], [DisconnectedAt], [ReconnectDeadlineAt], [LeftAt]
        )
        VALUES
        (
            NEWID(), @SeedRoomId, @SeedRoomPlayerUserId, CONCAT(N'player-', @SeedRoomCode), @SeedRoomPlayerName, N'PLAYER',
            CASE WHEN @SeedRoomStatus = N'WAITING' THEN 0 ELSE 1 END, 2,
            DATEADD(MINUTE, 3, @SeedRoomCreatedAt),
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED') THEN N'LEFT'
                 WHEN @SeedRoomStatus = N'PLAYING' AND @SeedRoomCode = N'SHOW304' THEN N'OFFLINE'
                 ELSE N'ONLINE' END,
            DATEADD(MINUTE, 28, @SeedRoomCreatedAt),
            CASE WHEN @SeedRoomStatus = N'PLAYING' AND @SeedRoomCode = N'SHOW304'
                 THEN DATEADD(MINUTE, 28, @SeedRoomCreatedAt) ELSE NULL END,
            CASE WHEN @SeedRoomStatus = N'PLAYING' AND @SeedRoomCode = N'SHOW304'
                 THEN DATEADD(MINUTE, 30, @SeedRoomCreatedAt) ELSE NULL END,
            CASE WHEN @SeedRoomStatus IN (N'COMPLETED', N'CANCELLED')
                 THEN DATEADD(MINUTE, 28, @SeedRoomCreatedAt) ELSE NULL END
        );
    END;

    FETCH NEXT FROM room_cursor INTO @SeedRoomCode, @SeedRoomStatus, @SeedRoomId, @SeedRoomCreatedAt, @SeedRoomSequence, @SeedRoomHostSequence, @SeedRoomPlayerSequence;
END;

CLOSE room_cursor;
DEALLOCATE room_cursor;

/* 遊戲回合、作答與投票：20 個可重現的歷史／進行中回合 */
DECLARE @RoundSeeds TABLE
(
    [RoomCode] nvarchar(12) NOT NULL,
    [RoundNumber] int NOT NULL,
    PRIMARY KEY ([RoomCode], [RoundNumber])
);

INSERT INTO @RoundSeeds ([RoomCode], [RoundNumber])
VALUES
    (N'SHOW303', 1), (N'SHOW303', 2), (N'SHOW303', 3),
    (N'SHOW304', 1), (N'SHOW304', 2), (N'SHOW304', 3), (N'SHOW304', 4), (N'SHOW304', 5),
    (N'SHOW305', 1), (N'SHOW305', 2), (N'SHOW305', 3),
    (N'SHOW306', 1), (N'SHOW306', 2),
    (N'SHOW307', 1), (N'SHOW307', 2), (N'SHOW307', 3),
    (N'SHOW308', 1), (N'SHOW308', 2), (N'SHOW308', 3), (N'SHOW308', 4);

DECLARE @RoundSeedIndex int = 1;
DECLARE @RoundSeedCode nvarchar(12);
DECLARE @RoundSeedNumber int;
DECLARE @RoundSeedRoomId uniqueidentifier;
DECLARE @RoundSeedArtifactId uniqueidentifier;
DECLARE @RoundSeedCurrentRoundNo int;
DECLARE @RoundSeedCreatedAt datetime2(3);
DECLARE @RoundSeedRoomStatus nvarchar(20);
DECLARE @RoundNow datetime2(3);
DECLARE @RoundStatus nvarchar(20);
DECLARE @RoundStartedAt datetime2(3);
DECLARE @RoundAnswerDeadlineAt datetime2(3);
DECLARE @RoundVotingDeadlineAt datetime2(3);
DECLARE @RoundSettledAt datetime2(3);

DECLARE round_seed_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT [RoomCode], [RoundNumber]
    FROM @RoundSeeds
    ORDER BY [RoomCode], [RoundNumber];

OPEN round_seed_cursor;
FETCH NEXT FROM round_seed_cursor INTO @RoundSeedCode, @RoundSeedNumber;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @RoundSeedRoomId = NULL;
    SELECT
        @RoundSeedRoomId = room.[Id],
        @RoundSeedCurrentRoundNo = room.[CurrentRoundNo],
        @RoundSeedCreatedAt = room.[CreatedAt],
        @RoundSeedRoomStatus = room.[Status]
    FROM [game].[GameRooms] AS room
    WHERE room.[RoomCode] = @RoundSeedCode;

    SET @RoundSeedArtifactId = NULL;
    SELECT @RoundSeedArtifactId = [Id]
    FROM [catalog].[Artifacts]
    ORDER BY [Id]
    OFFSET ((@RoundSeedIndex - 1) % @ShowcaseArtifactCount) ROWS FETCH NEXT 1 ROW ONLY;

    IF @RoundSeedRoomId IS NOT NULL
       AND @RoundSeedArtifactId IS NOT NULL
       AND NOT EXISTS
       (
           SELECT 1
           FROM [game].[GameRounds]
           WHERE [RoomId] = @RoundSeedRoomId
             AND [RoundNumber] = @RoundSeedNumber
       )
    BEGIN
        SET @RoundNow = CONVERT(datetime2(3), SYSUTCDATETIME());
        IF @RoundSeedRoomStatus = N'PLAYING'
           AND @RoundSeedNumber = @RoundSeedCurrentRoundNo
        BEGIN
            IF @RoundSeedCode = N'SHOW304'
            BEGIN
                SET @RoundStatus = N'VOTING';
                SET @RoundStartedAt = DATEADD(MINUTE, -130, @RoundNow);
                SET @RoundAnswerDeadlineAt = DATEADD(MINUTE, -10, @RoundNow);
                SET @RoundVotingDeadlineAt = DATEADD(MINUTE, 50, @RoundNow);
            END
            ELSE
            BEGIN
                SET @RoundStatus = N'ANSWERING';
                SET @RoundStartedAt = DATEADD(MINUTE, -5, @RoundNow);
                SET @RoundAnswerDeadlineAt = DATEADD(MINUTE, 115, @RoundNow);
                SET @RoundVotingDeadlineAt = DATEADD(MINUTE, 175, @RoundNow);
            END;
            SET @RoundSettledAt = NULL;
        END
        ELSE
        BEGIN
            SET @RoundStatus = N'REVEALED';
            SET @RoundStartedAt = DATEADD(MINUTE, 5 + ((@RoundSeedNumber - 1) * 4), @RoundSeedCreatedAt);
            SET @RoundAnswerDeadlineAt = DATEADD(MINUTE, 120, @RoundStartedAt);
            SET @RoundVotingDeadlineAt = DATEADD(MINUTE, 180, @RoundStartedAt);
            SET @RoundSettledAt = DATEADD(MINUTE, 200, @RoundStartedAt);
        END;

        INSERT INTO [game].[GameRounds]
        (
            [Id], [RoomId], [ArtifactId], [RoundNumber], [Status], [StateVersion], [IsSettled],
            [StartedAt], [AnswerDeadlineAt], [VotingDeadlineAt], [SettledAt]
        )
        VALUES
        (
            NEWID(), @RoundSeedRoomId, @RoundSeedArtifactId, @RoundSeedNumber, @RoundStatus,
            CASE WHEN @RoundStatus = N'REVEALED' THEN 3 ELSE 1 END,
            CASE WHEN @RoundStatus = N'REVEALED' THEN 1 ELSE 0 END,
            @RoundStartedAt, @RoundAnswerDeadlineAt, @RoundVotingDeadlineAt, @RoundSettledAt
        );
    END;

    SET @RoundSeedIndex += 1;
    FETCH NEXT FROM round_seed_cursor INTO @RoundSeedCode, @RoundSeedNumber;
END;

CLOSE round_seed_cursor;
DEALLOCATE round_seed_cursor;

DECLARE @ContentRoundId uniqueidentifier;
DECLARE @ContentRoomId uniqueidentifier;
DECLARE @ContentStartedAt datetime2(3);
DECLARE @HostGamePlayerId uniqueidentifier;
DECLARE @PlayerGamePlayerId uniqueidentifier;
DECLARE @HostAnswerId uniqueidentifier;
DECLARE @PlayerAnswerId uniqueidentifier;
DECLARE @AnswerVariant int;

DECLARE round_content_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT round.[Id], round.[RoomId], round.[StartedAt]
    FROM [game].[GameRounds] AS round
    WHERE round.[RoomId] IN (SELECT room.[Id] FROM [game].[GameRooms] AS room WHERE room.[RoomCode] IN (SELECT [RoomCode] FROM @RoomSeeds))
      AND round.[Status] = N'REVEALED'
    ORDER BY round.[RoomId], round.[RoundNumber];

OPEN round_content_cursor;
FETCH NEXT FROM round_content_cursor INTO @ContentRoundId, @ContentRoomId, @ContentStartedAt;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @HostGamePlayerId = NULL;
    SET @PlayerGamePlayerId = NULL;
    SET @AnswerVariant = DATEPART(MINUTE, @ContentStartedAt) % 4;
    SELECT TOP (1) @HostGamePlayerId = [Id]
    FROM [game].[GamePlayers]
    WHERE [RoomId] = @ContentRoomId AND [Role] = N'HOST'
    ORDER BY [SeatNo], [Id];
    SELECT TOP (1) @PlayerGamePlayerId = [Id]
    FROM [game].[GamePlayers]
    WHERE [RoomId] = @ContentRoomId AND [Role] = N'PLAYER'
    ORDER BY [SeatNo], [Id];

    UPDATE answer
    SET answer.[Text] = CASE WHEN answer.[AnswerType] = N'FACTUAL_REASONING' THEN
            CASE @AnswerVariant
                WHEN 0 THEN N'我先從器形、材質與尺寸欄位切入，再把器底和紋飾位置放在一起比較。這些線索目前支持它與同類館藏具有相近用途，但仍要以來源資料確認細部年代。'
                WHEN 1 THEN N'我把器口、腹部轉折與足部結構分開觀察，再回頭對照圖鑑的年代範圍。表面裝飾提供了方向，真正讓判讀較穩定的是幾個不同欄位彼此能夠互相印證。'
                WHEN 2 THEN N'目前可以直接確認的是材質與器形比例，至於製作地點和精確年代還不能只靠照片決定。我會把可見特徵、官方說明與尚待查證的推論分開記錄。'
                ELSE N'這件作品的外觀和同類器物有幾個共同點，但器底加工與尺寸比例仍值得再比對。我的判斷先停在合理範圍，不把一項紋飾直接當成唯一證據。'
            END
        ELSE
            CASE @AnswerVariant
                WHEN 0 THEN N'我注意到紋樣與使用痕跡的分布，推測它可能曾出現在禮儀或日常使用的場景。這是從影像提出的合理假設，不能取代圖鑑中的正式說明，還需要更多同類作品來支持。'
                WHEN 1 THEN N'如果只看表面顏色，我會猜它和某種固定用途有關；不過器身比例與磨耗位置也可能指向另一種使用情境。這個說法先當作待查線索，等找到文獻後再調整。'
                WHEN 2 THEN N'我把這件作品想成在特定場合被反覆取放的器物，因為邊緣和接合處留下了值得注意的變化。這段推測是為了說明觀察方向，並不是已經被來源資料證實的歷史敘述。'
                ELSE N'從紋飾節奏與器物的視覺重量來看，它可能在陳設或儀式中扮演重要角色。若要讓這個推測更可靠，還是要補上尺寸、出處和同類作品的比較結果。'
            END END
    FROM [game].[RoundAnswers] AS answer
    WHERE answer.[RoundId] = @ContentRoundId
      AND answer.[GamePlayerId] IN (@HostGamePlayerId, @PlayerGamePlayerId);

    IF @HostGamePlayerId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM [game].[RoundAnswers] WHERE [RoundId] = @ContentRoundId AND [GamePlayerId] = @HostGamePlayerId)
    BEGIN
        INSERT INTO [game].[RoundAnswers]
            ([Id], [RoundId], [GamePlayerId], [AnswerType], [Text], [SubmittedAt])
        VALUES
            (NEWID(), @ContentRoundId, @HostGamePlayerId, N'FACTUAL_REASONING',
             CASE @AnswerVariant
                 WHEN 0 THEN N'我先從器形、材質與尺寸欄位切入，再把器底和紋飾位置放在一起比較。這些線索目前支持它與同類館藏具有相近用途，但仍要以來源資料確認細部年代。'
                 WHEN 1 THEN N'我把器口、腹部轉折與足部結構分開觀察，再回頭對照圖鑑的年代範圍。表面裝飾提供了方向，真正讓判讀較穩定的是幾個不同欄位彼此能夠互相印證。'
                 WHEN 2 THEN N'目前可以直接確認的是材質與器形比例，至於製作地點和精確年代還不能只靠照片決定。我會把可見特徵、官方說明與尚待查證的推論分開記錄。'
                 ELSE N'這件作品的外觀和同類器物有幾個共同點，但器底加工與尺寸比例仍值得再比對。我的判斷先停在合理範圍，不把一項紋飾直接當成唯一證據。'
             END,
             DATEADD(MINUTE, 1, @ContentStartedAt));
    END;

    IF @PlayerGamePlayerId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM [game].[RoundAnswers] WHERE [RoundId] = @ContentRoundId AND [GamePlayerId] = @PlayerGamePlayerId)
    BEGIN
        INSERT INTO [game].[RoundAnswers]
            ([Id], [RoundId], [GamePlayerId], [AnswerType], [Text], [SubmittedAt])
        VALUES
            (NEWID(), @ContentRoundId, @PlayerGamePlayerId, N'PLAUSIBLE_FICTION',
             CASE @AnswerVariant
                 WHEN 0 THEN N'我注意到紋樣與使用痕跡的分布，推測它可能曾出現在禮儀或日常使用的場景。這是從影像提出的合理假設，不能取代圖鑑中的正式說明，還需要更多同類作品來支持。'
                 WHEN 1 THEN N'如果只看表面顏色，我會猜它和某種固定用途有關；不過器身比例與磨耗位置也可能指向另一種使用情境。這個說法先當作待查線索，等找到文獻後再調整。'
                 WHEN 2 THEN N'我把這件作品想成在特定場合被反覆取放的器物，因為邊緣和接合處留下了值得注意的變化。這段推測是為了說明觀察方向，並不是已經被來源資料證實的歷史敘述。'
                 ELSE N'從紋飾節奏與器物的視覺重量來看，它可能在陳設或儀式中扮演重要角色。若要讓這個推測更可靠，還是要補上尺寸、出處和同類作品的比較結果。'
             END,
             DATEADD(MINUTE, 2, @ContentStartedAt));
    END;

    SET @HostAnswerId = NULL;
    SET @PlayerAnswerId = NULL;
    SELECT @HostAnswerId = [Id]
    FROM [game].[RoundAnswers]
    WHERE [RoundId] = @ContentRoundId AND [GamePlayerId] = @HostGamePlayerId;
    SELECT @PlayerAnswerId = [Id]
    FROM [game].[RoundAnswers]
    WHERE [RoundId] = @ContentRoundId AND [GamePlayerId] = @PlayerGamePlayerId;

    IF @HostGamePlayerId IS NOT NULL AND @PlayerGamePlayerId IS NOT NULL
       AND @HostGamePlayerId <> @PlayerGamePlayerId
    BEGIN
        IF @HostAnswerId IS NOT NULL
           AND NOT EXISTS
           (
               SELECT 1 FROM [game].[Votes]
               WHERE [RoundId] = @ContentRoundId
                 AND [VoterGamePlayerId] = @PlayerGamePlayerId
                 AND [AnswerId] = @HostAnswerId
           )
        BEGIN
            INSERT INTO [game].[Votes]
                ([Id], [RoundId], [VoterGamePlayerId], [AnswerId], [Count], [SubmittedAt])
            VALUES
                (NEWID(), @ContentRoundId, @PlayerGamePlayerId, @HostAnswerId, 1, DATEADD(MINUTE, 150, @ContentStartedAt));
        END;

        IF @PlayerAnswerId IS NOT NULL
           AND NOT EXISTS
           (
               SELECT 1 FROM [game].[Votes]
               WHERE [RoundId] = @ContentRoundId
                 AND [VoterGamePlayerId] = @HostGamePlayerId
                 AND [AnswerId] = @PlayerAnswerId
           )
        BEGIN
            INSERT INTO [game].[Votes]
                ([Id], [RoundId], [VoterGamePlayerId], [AnswerId], [Count], [SubmittedAt])
            VALUES
                (NEWID(), @ContentRoundId, @HostGamePlayerId, @PlayerAnswerId, 2, DATEADD(MINUTE, 151, @ContentStartedAt));
        END;
    END;

    FETCH NEXT FROM round_content_cursor INTO @ContentRoundId, @ContentRoomId, @ContentStartedAt;
END;

CLOSE round_content_cursor;
DEALLOCATE round_content_cursor;

/* 商城訂單、明細與付款紀錄 */
DECLARE @OrderIndex int = 1;
DECLARE @OrderNo nvarchar(30);
DECLARE @OrderId uniqueidentifier;
DECLARE @OrderUserId uniqueidentifier;
DECLARE @ProductId uniqueidentifier;
DECLARE @ProductName nvarchar(200);
DECLARE @UnitPrice decimal(12,2);
DECLARE @Quantity int;
DECLARE @Subtotal decimal(12,2);
DECLARE @DiscountAmount decimal(12,2);
DECLARE @PointsUsed int;
DECLARE @TotalAmount decimal(12,2);
DECLARE @OrderStatus nvarchar(30);
DECLARE @PaymentStatus nvarchar(20);
DECLARE @OrderCreatedAt datetime2(3);
DECLARE @OrderMemberName nvarchar(80);
DECLARE @OrderRecipientName nvarchar(80);
DECLARE @OrderRecipientPhone nvarchar(30);
DECLARE @ShowcaseProductCount int =
(
    SELECT COUNT(*)
    FROM [store].[Products]
    WHERE [ArtifactId] IS NOT NULL
      AND [ExternalRef] LIKE N'artifact-%'
);

IF @ShowcaseProductCount = 0
    THROW 50002, '需要先有文物關聯的縮小複製品商品才能建立歷史交易資料', 1;

WHILE @OrderIndex <= 80
BEGIN
    SET @OrderNo = CONCAT(N'QMAH-SHOW-', RIGHT(CONCAT(N'0000', @OrderIndex), 4));

    IF NOT EXISTS (SELECT 1 FROM [store].[StoreOrders] WHERE [OrderNo] = @OrderNo)
    BEGIN
        SET @OrderId = NEWID();
        SELECT @OrderUserId = [UserId], @OrderMemberName = [DisplayName]
        FROM @ShowcaseUsers
        WHERE [SequenceNo] = ((@OrderIndex - 1) % @ShowcaseUserCount) + 1;
        SET @OrderRecipientName = CONCAT(@OrderMemberName, N' 收');
        SET @OrderRecipientPhone = CONCAT(N'09', RIGHT(CONCAT(N'00000000', @OrderIndex * 137), 8));

        SET @ProductId = NULL;
        SET @ProductName = NULL;
        SET @UnitPrice = NULL;
        SELECT @ProductId = [Id], @ProductName = [Name], @UnitPrice = [Price]
        FROM [store].[Products]
        WHERE [ArtifactId] IS NOT NULL
          AND [ExternalRef] LIKE N'artifact-%'
        ORDER BY [Name], [Id]
        OFFSET ((@OrderIndex * 7) % @ShowcaseProductCount) ROWS FETCH NEXT 1 ROW ONLY;

        IF @ProductId IS NULL
            THROW 50002, '找不到可供展示訂單使用的文物縮小複製品商品', 1;

        SET @Quantity = CASE @OrderIndex % 10
            WHEN 0 THEN 3
            WHEN 4 THEN 2
            WHEN 8 THEN 2
            ELSE 1 END;
        SET @Subtotal = @UnitPrice * @Quantity;
        -- 展示訂單不假造優惠券與點數扣抵；需要扣抵的情境由正式購物流程建立對應 ledger。
        SET @DiscountAmount = 0;
        SET @PointsUsed = 0;
        SET @TotalAmount = @Subtotal - @DiscountAmount - @PointsUsed;
        SET @OrderStatus = CASE (@OrderIndex - 1) % 12
            WHEN 0 THEN N'PENDING_PAYMENT'
            WHEN 1 THEN N'PAID'
            WHEN 2 THEN N'PAID'
            WHEN 3 THEN N'FULFILLING'
            WHEN 4 THEN N'FULFILLING'
            WHEN 5 THEN N'SHIPPED'
            WHEN 6 THEN N'SHIPPED'
            WHEN 7 THEN N'COMPLETED'
            WHEN 8 THEN N'COMPLETED'
            WHEN 9 THEN N'CANCELLED'
            WHEN 10 THEN N'PAID'
            ELSE N'COMPLETED' END;
        SET @PaymentStatus = CASE
            WHEN @OrderStatus = N'PENDING_PAYMENT' THEN N'PENDING'
            WHEN @OrderStatus = N'CANCELLED' THEN N'FAILED'
            ELSE N'PAID' END;
        /* 約一年內分散日期，讓長期趨勢有高低變化，也不把資料推到展示範圍之外。 */
        SET @OrderCreatedAt = DATEADD(DAY, -(((@OrderIndex - 1) * 4) + ((@OrderIndex * 3) % 9)), @ShowcaseNow);

        INSERT INTO [store].[StoreOrders]
        (
            [Id], [OrderNo], [UserId], [UserCouponId], [Status], [Subtotal],
            [DiscountAmount], [PointsUsed], [TotalAmount], [RecipientName],
            [RecipientPhone], [ShippingPostalCode], [ShippingCity], [ShippingDistrict],
            [ShippingAddressLine], [CreatedAt], [PaidAt], [CancelledAt]
        )
        VALUES
        (
            @OrderId, @OrderNo, @OrderUserId, NULL, @OrderStatus, @Subtotal,
            @DiscountAmount, @PointsUsed, @TotalAmount,
            @OrderRecipientName,
            @OrderRecipientPhone,
            CASE @OrderIndex % 6 WHEN 0 THEN N'100' WHEN 1 THEN N'106' WHEN 2 THEN N'220' WHEN 3 THEN N'400' WHEN 4 THEN N'700' ELSE N'801' END,
            CASE @OrderIndex % 6 WHEN 0 THEN N'臺北市' WHEN 1 THEN N'臺北市' WHEN 2 THEN N'新北市' WHEN 3 THEN N'臺中市' WHEN 4 THEN N'臺南市' ELSE N'高雄市' END,
            CASE @OrderIndex % 6 WHEN 0 THEN N'中正區' WHEN 1 THEN N'大安區' WHEN 2 THEN N'板橋區' WHEN 3 THEN N'西區' WHEN 4 THEN N'中西區' ELSE N'前金區' END,
            CASE @OrderIndex % 6
                WHEN 0 THEN CONCAT(N'重慶南路一段 ', @OrderIndex + 9, N' 號')
                WHEN 1 THEN CONCAT(N'復興南路一段 ', @OrderIndex + 9, N' 號')
                WHEN 2 THEN CONCAT(N'文化路一段 ', @OrderIndex + 9, N' 號')
                WHEN 3 THEN CONCAT(N'公益路 ', @OrderIndex + 9, N' 號')
                WHEN 4 THEN CONCAT(N'府前路二段 ', @OrderIndex + 9, N' 號')
                ELSE CONCAT(N'中正四路 ', @OrderIndex + 9, N' 號') END,
            @OrderCreatedAt,
            CASE WHEN @PaymentStatus = N'PAID' THEN DATEADD(MINUTE, 5, @OrderCreatedAt) ELSE NULL END,
            CASE WHEN @OrderStatus = N'CANCELLED' THEN DATEADD(MINUTE, 8, @OrderCreatedAt) ELSE NULL END
        );

        INSERT INTO [store].[OrderDetails]
            ([Id], [OrderId], [ProductId], [ProductNameSnapshot], [UnitPrice], [Quantity], [LineTotal])
        VALUES
            (NEWID(), @OrderId, @ProductId, @ProductName, @UnitPrice, @Quantity, @Subtotal);

        INSERT INTO [store].[Payments]
        (
            [Id], [OrderId], [MerchantTradeNo], [EcpayTradeNo], [Amount], [Status],
            [RtnCode], [RtnMsg], [PaymentType], [CallbackReceivedAt], [CreatedAt]
        )
        VALUES
        (
            NEWID(), @OrderId, CONCAT(N'QMSHOW', RIGHT(CONCAT(N'000000', @OrderIndex), 6)),
            CASE WHEN @PaymentStatus = N'PAID' THEN CONCAT(N'QMAH-EC-', RIGHT(CONCAT(N'000000', @OrderIndex), 6)) ELSE NULL END,
            @TotalAmount, @PaymentStatus,
            CASE WHEN @PaymentStatus = N'PAID' THEN 1 WHEN @PaymentStatus = N'FAILED' THEN 0 ELSE NULL END,
            CASE WHEN @PaymentStatus = N'PAID' THEN N'付款成功'
                 WHEN @PaymentStatus = N'FAILED' THEN N'付款失敗'
                 ELSE NULL END,
            N'Credit_CreditCard',
            CASE WHEN @PaymentStatus IN (N'PAID', N'FAILED') THEN DATEADD(MINUTE, 5, @OrderCreatedAt) ELSE NULL END,
            @OrderCreatedAt
        );
    END;

    SET @OrderIndex += 1;
END;

/* 將舊版訂單也補上會員分布與合理的收件資料，保留訂單金額與狀態歷史。 */
;WITH ShowcaseOrders AS
(
    SELECT
        orderData.[Id],
        CONVERT(int, RIGHT(orderData.[OrderNo], 4)) AS [OrderIndex]
    FROM [store].[StoreOrders] AS orderData
    WHERE orderData.[OrderNo] LIKE N'QMAH-SHOW-%'
)
UPDATE orderData
SET orderData.[UserId] = member.[UserId],
    orderData.[CreatedAt] = DATEADD(DAY, -(((showcase.[OrderIndex] - 1) * 4) + ((showcase.[OrderIndex] * 3) % 9)), @ShowcaseNow),
    orderData.[PaidAt] = CASE WHEN orderData.[Status] NOT IN (N'PENDING_PAYMENT', N'CANCELLED')
        THEN DATEADD(MINUTE, 5, DATEADD(DAY, -(((showcase.[OrderIndex] - 1) * 4) + ((showcase.[OrderIndex] * 3) % 9)), @ShowcaseNow))
        ELSE NULL END,
    orderData.[CancelledAt] = CASE WHEN orderData.[Status] = N'CANCELLED'
        THEN DATEADD(MINUTE, 8, DATEADD(DAY, -(((showcase.[OrderIndex] - 1) * 4) + ((showcase.[OrderIndex] * 3) % 9)), @ShowcaseNow))
        ELSE NULL END,
    orderData.[RecipientName] = CONCAT(member.[DisplayName], N' 收'),
    orderData.[RecipientPhone] = CONCAT(N'09', RIGHT(CONCAT(N'00000000', showcase.[OrderIndex] * 137), 8)),
    orderData.[ShippingPostalCode] = CASE showcase.[OrderIndex] % 6 WHEN 0 THEN N'100' WHEN 1 THEN N'106' WHEN 2 THEN N'220' WHEN 3 THEN N'400' WHEN 4 THEN N'700' ELSE N'801' END,
    orderData.[ShippingCity] = CASE showcase.[OrderIndex] % 6 WHEN 0 THEN N'臺北市' WHEN 1 THEN N'臺北市' WHEN 2 THEN N'新北市' WHEN 3 THEN N'臺中市' WHEN 4 THEN N'臺南市' ELSE N'高雄市' END,
    orderData.[ShippingDistrict] = CASE showcase.[OrderIndex] % 6 WHEN 0 THEN N'中正區' WHEN 1 THEN N'大安區' WHEN 2 THEN N'板橋區' WHEN 3 THEN N'西區' WHEN 4 THEN N'中西區' ELSE N'前金區' END,
    orderData.[ShippingAddressLine] = CASE showcase.[OrderIndex] % 6
        WHEN 0 THEN CONCAT(N'重慶南路一段 ', showcase.[OrderIndex] + 9, N' 號')
        WHEN 1 THEN CONCAT(N'復興南路一段 ', showcase.[OrderIndex] + 9, N' 號')
        WHEN 2 THEN CONCAT(N'文化路一段 ', showcase.[OrderIndex] + 9, N' 號')
        WHEN 3 THEN CONCAT(N'公益路 ', showcase.[OrderIndex] + 9, N' 號')
        WHEN 4 THEN CONCAT(N'府前路二段 ', showcase.[OrderIndex] + 9, N' 號')
        ELSE CONCAT(N'中正四路 ', showcase.[OrderIndex] + 9, N' 號') END
FROM [store].[StoreOrders] AS orderData
INNER JOIN ShowcaseOrders AS showcase ON showcase.[Id] = orderData.[Id]
INNER JOIN @ShowcaseUsers AS member ON member.[SequenceNo] = ((showcase.[OrderIndex] - 1) % @ShowcaseUserCount) + 1;

UPDATE payment
SET payment.[EcpayTradeNo] = CASE WHEN payment.[Status] = N'PAID'
    THEN CONCAT(N'QMAH-EC-', RIGHT(CONCAT(N'000000', showcase.[OrderIndex]), 6)) ELSE NULL END
FROM [store].[Payments] AS payment
INNER JOIN [store].[StoreOrders] AS orderData ON orderData.[Id] = payment.[OrderId]
INNER JOIN
(
    SELECT [Id], CONVERT(int, RIGHT([OrderNo], 4)) AS [OrderIndex]
    FROM [store].[StoreOrders]
    WHERE [OrderNo] LIKE N'QMAH-SHOW-%'
) AS showcase ON showcase.[Id] = orderData.[Id];

COMMIT TRANSACTION;

SELECT
    (SELECT COUNT(*) FROM [social].[SocialPosts]) AS [SocialPosts],
    (SELECT COUNT(*) FROM [social].[SocialComments]) AS [SocialComments],
    (SELECT COUNT(*) FROM [game].[GameRooms]) AS [GameRooms],
    (SELECT COUNT(*) FROM [game].[GamePlayers]) AS [GamePlayers],
    (SELECT COUNT(*) FROM [store].[StoreOrders]) AS [StoreOrders],
    (SELECT COUNT(*) FROM [store].[OrderDetails]) AS [OrderDetails],
    (SELECT COUNT(*) FROM [store].[Payments]) AS [Payments];
