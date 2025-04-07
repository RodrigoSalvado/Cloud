<?php
// Se o formulário foi submetido
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nome = $_POST["nome"];
    $set = $_POST["set"];

    // URL da Azure Function
    $url = "https://function-miniprojeto.azurewebsites.net/api/http_trigger?nome=" . urlencode($nome) . "&set=" . urlencode($set);

    // Chamada HTTP à Azure Function
    $response = file_get_contents($url);
}
?>

<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>Consulta Reddit</title>
</head>
<body>
    <h1>Pesquisar no Reddit</h1>
    <form method="POST">
        <label for="nome">Subreddit:</label>
        <input type="text" id="nome" name="nome" required><br><br>

        <label for="set">Tipo (ex: hot, new, top):</label>
        <input type="text" id="set" name="set" required><br><br>

        <button type="submit">Pesquisar</button>
    </form>

    <?php if (!empty($response)): ?>
        <h2>Resultados:</h2>
        <pre><?php echo htmlspecialchars($response); ?></pre>
    <?php endif; ?>
</body>
</html>
