# ゴルフ記録 (golf-log)

日付・場所・スコア・メモを入力して保存し、一覧表示できる最小構成の Android アプリです。

- Kotlin + Jetpack Compose (Material 3)
- データはアプリ内部ストレージの `rounds.json` に保存（外部ライブラリ不要）
- 一覧は日付の新しい順。各記録の「削除」ボタンで確認ダイアログ付きで削除できます
- minSdk 26 (Android 8.0) / targetSdk 36

## 構成

```
app/src/main/java/com/example/golflog/
├── MainActivity.kt     # 入力フォーム + 一覧画面
├── GolfRound.kt        # 記録のデータクラス（JSON 変換つき）
└── RoundRepository.kt  # JSON ファイルへの読み書き
```

## 必要なもの

- JDK 17 以上（Android Studio 同梱の JDK でも可）
- Android SDK（Platform 36 と Build-Tools）

Android Studio を使う場合は、このフォルダを開くだけで SDK のパスが自動設定されます。

## APK の作り方

### 方法 A: Android Studio

1. Android Studio で `golf-log` フォルダを開く（Gradle 同期を待つ）
2. メニュー **Build > Build App Bundle(s) / APK(s) > Build APK(s)**
3. 完了通知の **locate** から `app-debug.apk` を開けます

### 方法 B: コマンドライン

1. SDK の場所を指定します（どちらか一方）
   - 環境変数: `export ANDROID_HOME=$HOME/Android/Sdk`
   - またはプロジェクト直下に `local.properties` を作成: `sdk.dir=/path/to/Android/Sdk`
2. デバッグ APK をビルド

   ```sh
   ./gradlew assembleDebug        # Windows は gradlew.bat assembleDebug
   ```

3. 出力先: `app/build/outputs/apk/debug/app-debug.apk`

### 実機へのインストール

- USB 接続（端末で「USB デバッグ」を有効化）して:

  ```sh
  ./gradlew installDebug
  # または
  adb install -r app/build/outputs/apk/debug/app-debug.apk
  ```

- もしくは APK ファイルを端末に送り、ファイルアプリから開いてインストール
  （「提供元不明のアプリ」の許可が必要です）

### 配布用（署名付きリリース APK）

`./gradlew assembleRelease` だけでは**未署名**の APK（`app-release-unsigned.apk`）になり、そのままではインストールできません。

- Android Studio の **Build > Generate Signed App Bundle / APK...** から鍵（keystore）を作成・選択するのが一番簡単です。
- コマンドラインで行う場合は、keystore を作って `apksigner` で署名します:

  ```sh
  keytool -genkeypair -v -keystore my-release.jks -alias golflog \
    -keyalg RSA -keysize 2048 -validity 10000
  ./gradlew assembleRelease
  $ANDROID_HOME/build-tools/36.0.0/zipalign -v -p 4 \
    app/build/outputs/apk/release/app-release-unsigned.apk app-release-aligned.apk
  $ANDROID_HOME/build-tools/36.0.0/apksigner sign \
    --ks my-release.jks --out app-release.apk app-release-aligned.apk
  ```

  keystore とパスワードは紛失するとアップデートを配布できなくなるので、リポジトリに含めず安全に保管してください（`.gitignore` で `*.jks` は除外済み）。
