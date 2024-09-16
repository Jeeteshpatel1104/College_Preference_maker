const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

// Set up EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse POST data
app.use(express.urlencoded({ extended: true }));


// MySQL connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '##sBi123',
    database: 'clg_predictor'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});


function generateCategories(selectedCaste, selectedClass, selectedGender, domicile) {
    // Define default categories
    const categories = [];

    // UR/X/OP must be included for any domicile = 'AI'
    if (domicile === 'AI') {
        categories.push('UR/X/OP');
    }

    // Special cases where only caste is considered
    const specialCastes = ['EWS', 'JKM', 'JKR', 'NTPC'];
    if (specialCastes.includes(selectedCaste)) {
        categories.push(selectedCaste);  // No class or gender considered
        return categories;  // Exit early since no more categories are needed
    }

    // Special case for FW: add 'FW/OP' only
    if (selectedCaste === 'FW') {
        categories.push('FW/OP');
        return categories;  // Exit early since no other categories are needed
    }

    // Add the main selected category combination
    const mainCategory = `${selectedCaste}/${selectedClass}/${selectedGender}`;
    categories.push(mainCategory);

    // If gender is 'F', also add the same caste/class with gender 'OP'
    if (selectedGender === 'F') {
        const genderOPCategory = `${selectedCaste}/${selectedClass}/OP`;
        categories.push(genderOPCategory);
    }

    // If class is not 'X', add the same caste/gender with class 'X'
    if (selectedClass !== 'X') {
        const nillClassCategory = `${selectedCaste}/X/${selectedGender}`;
        categories.push(nillClassCategory);

        // If gender is 'F', add the NILL class with gender 'OP'
        if (selectedGender === 'F') {
            const nillClassOPCategory = `${selectedCaste}/X/OP`;
            categories.push(nillClassOPCategory);
        }
    }

    return categories;
}

// Example usage


app.get('/', (req, res) => {
    const collegeNameQuery = 'SELECT DISTINCT college_name FROM data_table';
    const instituteTypeQuery = 'SELECT DISTINCT institute_type FROM data_table';
    const cityQuery = 'SELECT DISTINCT city FROM data_table';
    const yearQuery = 'SELECT DISTINCT year FROM data_table';
    const roundQuery = 'SELECT DISTINCT round FROM data_table';
    const query = `SELECT DISTINCT branch FROM data_table`;



    db.query(collegeNameQuery, (err, collegeNames) => {
        if (err) {
            console.error('Error fetching college names:', err);
            return res.status(500).send('Internal Server Error');
        }

        db.query(instituteTypeQuery, (err, instituteTypes) => {
            if (err) {
                console.error('Error fetching institute types:', err);
                return res.status(500).send('Internal Server Error');
            }

            db.query(cityQuery, (err, cities) => {
                if (err) {
                    console.error('Error fetching cities:', err);
                    return res.status(500).send('Internal Server Error');
                }

                db.query(yearQuery, (err, years) => {
                    if (err) {
                        console.error('Error fetching years:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    db.query(roundQuery, (err, rounds) => {
                        if (err) {
                            console.error('Error fetching rounds:', err);
                            return res.status(500).send('Internal Server Error');
                        }

                        db.query(query, (err, branchResults) => {
                            if (err) {
                                console.error('Error fetching branches:', err);
                                return res.status(500).send('Internal Server Error');
                            }

                        res.render('index', {
                            collegeNames: collegeNames.map(row => row.college_name),
                            instituteTypes: instituteTypes.map(row => row.institute_type),
                            cities: cities.map(row => row.city),
                            years: years.map(row => row.year),
                            rounds: rounds.map(row => row.round),
                            castes: ['EWS', 'FW', 'OBC', 'SC', 'ST', 'UR'], // Caste options
                            classes: ['X', 'H', 'S', 'NCC', 'FF'], // Class options
                            genders: ['OP', 'F'], // Gender options
                            branches: branchResults,
                        });
                    });
                });
            });
        });
    });
});

});


app.post('/search', (req, res) => {
    const rank = parseInt(req.body.rank);
    const selectedCaste = req.body.caste;
    const selectedClass = req.body.class;
    const selectedGender = req.body.gender;
    const selectedCollegeNames = req.body.college_name || [];
    const instituteTypes = req.body.institute_type || [];
    const selectedCities = req.body.city || [];
    const selectedYear = req.body.year;
    const selectedRound = req.body.round;
    const rankRange = parseInt(req.body.rank_range);
    const domicile = req.body.domicile;
    const sortBy = req.body.sort_by || 'closing_rank';  // New sorting filter
    const selectedBranches = req.body.branch || [];

    const lowerBound = rank - rankRange;
    const upperBound = rank + rankRange;

    let branchQuery = '';
    if (selectedBranches.length > 0) {
        branchQuery = selectedBranches.map(branch => `'${branch}'`).join(',');
    } else {
        branchQuery = `SELECT DISTINCT branch FROM data_table`;
    }

    let instituteTypeQuery = '';
    if (Array.isArray(instituteTypes)) {
        instituteTypeQuery = instituteTypes.map(type => `'${type}'`).join(',');
    } else {
        instituteTypeQuery = `'${instituteTypes}'`;
    }

    let cityQuery = '';
    if (Array.isArray(selectedCities)) {
        cityQuery = selectedCities.map(city => `'${city}'`).join(',');
    } else {
        cityQuery = `'${selectedCities}'`;
    }

    let domicileCondition = '';
    if (domicile === 'AI') {
        domicileCondition = 'AND (domicile = "AI" OR domicile = "PR" OR domicile = "NO")';
    } else if (domicile === 'Y') {
        domicileCondition = 'AND (domicile = "YE" OR domicile = "PR")';
    }

    // Generate categories based on selected caste, class, and gender
    const categories = generateCategories(selectedCaste, selectedClass, selectedGender, domicile);

    // Create a query condition for the categories
    const categoryCondition = categories.map(cat => `allotted_category = '${cat}'`).join(' OR ');

    // Handling multiple college names in the query
    let collegeNameQuery = '';
    if (selectedCollegeNames.length > 0) {
        collegeNameQuery = `college_name IN (${selectedCollegeNames.map(name => `'${name}'`).join(',')})`;
    } else {
        collegeNameQuery = '1=1'; // Default condition if no colleges are selected
    }

    // Adjust the sorting order based on user choice (either 'closing_rank' or 'opening_rank')
    const query = `
        SELECT college_name, institute_type, branch, allotted_category, opening_rank, closing_rank, city, year, round
        FROM data_table
        WHERE closing_rank BETWEEN ? AND ?
        AND (${categoryCondition})
        AND (${collegeNameQuery})
        AND institute_type IN (${instituteTypeQuery})
        AND branch IN (${branchQuery})  
        AND city IN (${cityQuery})
        AND year = ?
        AND round = ?
        ${domicileCondition}
        ORDER BY ${sortBy} ASC
    `;

    db.query(query, [lowerBound, upperBound, selectedYear, selectedRound], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Track the highest closing rank for each college-branch combination
        const uniqueResults = {};

        results.forEach(row => {
            const key = `${row.college_name}-${row.branch}`;
            if (!uniqueResults[key] || row.closing_rank > uniqueResults[key].closing_rank) {
                // If no entry exists or the current row has a higher closing rank, store it
                uniqueResults[key] = row;
            }
        });

        // Convert the object back to an array and sort by closing rank
        const finalResults = Object.values(uniqueResults).sort((a, b) => a[sortBy] - b[sortBy]);

        console.log('Filtered and Sorted Results:', finalResults); // Print the final results for debugging
        res.render('results', { results: finalResults });
    });
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});




// app.post('/search', (req, res) => {
//     const rank = parseInt(req.body.rank);
//     const selectedCaste = req.body.caste;
//     const selectedClass = req.body.class;
//     const selectedGender = req.body.gender;
//     const collegeName = req.body.college_name || '%';
//     const instituteTypes = req.body.institute_type || [];
//     const selectedCities = req.body.city || [];
//     const selectedYear = req.body.year;
//     const selectedRound = req.body.round;
//     const rankRange = parseInt(req.body.rank_range);
//     const domicile = req.body.domicile;
    

//     const lowerBound = rank - rankRange;
//     const upperBound = rank + rankRange;

//     let instituteTypeQuery = '';
//     if (Array.isArray(instituteTypes)) {
//         instituteTypeQuery = instituteTypes.map(type => `'${type}'`).join(',');
//     } else {
//         instituteTypeQuery = `'${instituteTypes}'`;
//     }

//     let cityQuery = '';
//     if (Array.isArray(selectedCities)) {
//         cityQuery = selectedCities.map(city => `'${city}'`).join(',');
//     } else {
//         cityQuery = `'${selectedCities}'`;
//     }

//     let domicileCondition = '';
//     if (domicile === 'AI') {
//         domicileCondition = 'AND (domicile = "AI" OR domicile = "PR" OR domicile = "NO")';
//     } else if (domicile === 'Y') {
//         domicileCondition = 'AND (domicile = "YE" OR domicile = "PR")';
//     }

//     // Generate categories based on selected caste, class, and gender
//     const categories = generateCategories(selectedCaste, selectedClass, selectedGender, domicile);

//     // Create a query condition for the categories
//     const categoryCondition = categories.map(cat => `allotted_category = '${cat}'`).join(' OR ');

//     const query = `
//         SELECT college_name, institute_type, branch, allotted_category, opening_rank, closing_rank, city, year, round
//         FROM data_table
//         WHERE closing_rank BETWEEN ? AND ?
//         AND (${categoryCondition})
//         AND college_name LIKE ?
//         AND institute_type IN (${instituteTypeQuery})
//         AND city IN (${cityQuery})
//         AND year = ?
//         AND round = ?
//         ${domicileCondition}
//         ORDER BY closing_rank ASC
//     `;

//     db.query(query, [lowerBound, upperBound, collegeName, selectedYear, selectedRound], (err, results) => {
//         if (err) {
//             console.error('Error executing query:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         // Track the highest closing rank for each college-branch combination
//         const uniqueResults = {};

//         results.forEach(row => {
//             const key = `${row.college_name}-${row.branch}`;
//             if (!uniqueResults[key] || row.closing_rank > uniqueResults[key].closing_rank) {
//                 // If no entry exists or the current row has a higher closing rank, store it
//                 uniqueResults[key] = row;
//             }
//         });

//         // Convert the object back to an array and sort by closing rank
//         const finalResults = Object.values(uniqueResults).sort((a, b) => a.closing_rank - b.closing_rank);

//         console.log('Filtered and Sorted Results:', finalResults); // Print the final results for debugging
//         res.render('results', { results: finalResults });
//     });
// });
