package com.example.golflog

import android.app.DatePickerDialog
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.LocalDate

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val repository = RoundRepository(applicationContext)
        setContent {
            MaterialTheme {
                GolfLogScreen(repository)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GolfLogScreen(repository: RoundRepository) {
    var rounds by remember { mutableStateOf(repository.loadAll()) }
    var pendingDelete by remember { mutableStateOf<GolfRound?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("ゴルフ記録") }) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                RoundForm(onSave = { rounds = repository.add(it) })
            }
            item {
                Text(
                    text = "記録一覧（${rounds.size}件）",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            if (rounds.isEmpty()) {
                item { Text("まだ記録がありません。") }
            }
            items(rounds, key = { it.id }) { round ->
                RoundItem(round, onDelete = { pendingDelete = round })
            }
        }
    }

    pendingDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("記録を削除しますか？") },
            text = { Text("${target.date}  ${target.place}  ${target.score}") },
            confirmButton = {
                TextButton(onClick = {
                    rounds = repository.delete(target.id)
                    pendingDelete = null
                }) { Text("削除") }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text("キャンセル") }
            },
        )
    }
}

@Composable
fun RoundForm(onSave: (GolfRound) -> Unit) {
    val context = LocalContext.current
    var date by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var place by rememberSaveable { mutableStateOf("") }
    var score by rememberSaveable { mutableStateOf("") }
    var memo by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf<String?>(null) }

    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row {
                OutlinedButton(onClick = {
                    val current = LocalDate.parse(date)
                    DatePickerDialog(
                        context,
                        { _, y, m, d -> date = LocalDate.of(y, m + 1, d).toString() },
                        current.year, current.monthValue - 1, current.dayOfMonth,
                    ).show()
                }) { Text("日付: $date") }
            }
            OutlinedTextField(
                value = place,
                onValueChange = { place = it },
                label = { Text("場所（ゴルフ場）") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = score,
                onValueChange = { input -> score = input.filter { it.isDigit() }.take(3) },
                label = { Text("スコア") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = memo,
                onValueChange = { memo = it },
                label = { Text("メモ") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )
            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
            }
            Button(
                onClick = {
                    val scoreValue = score.toIntOrNull()
                    when {
                        place.isBlank() -> error = "場所を入力してください"
                        scoreValue == null || scoreValue <= 0 -> error = "スコアを入力してください"
                        else -> {
                            onSave(
                                GolfRound(
                                    id = System.currentTimeMillis(),
                                    date = date,
                                    place = place.trim(),
                                    score = scoreValue,
                                    memo = memo.trim(),
                                )
                            )
                            place = ""; score = ""; memo = ""; error = null
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("保存") }
        }
    }
}

@Composable
fun RoundItem(round: GolfRound, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                Text(round.date, style = MaterialTheme.typography.labelMedium)
                Text(round.place, style = MaterialTheme.typography.titleMedium)
                if (round.memo.isNotEmpty()) {
                    Text(round.memo, style = MaterialTheme.typography.bodyMedium)
                }
            }
            Spacer(Modifier.width(8.dp))
            Column {
                Text("${round.score}", style = MaterialTheme.typography.headlineMedium)
                TextButton(onClick = onDelete) { Text("削除") }
            }
        }
    }
}
