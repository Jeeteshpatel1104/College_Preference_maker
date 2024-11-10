const express = require('express');
const mysql = require('mysql2');
const path = require('path');


const app = express();
app.use(express.static('public'));
app.use(express.json()); // Ensure this middleware is used



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




function generateCategories(selectedCaste, selectedClass, selectedGender) {
    const categories = [];

    const specialCastes = ['EWS', 'JKM', 'JKR', 'NTPC'];
    if (specialCastes.includes(selectedCaste)) {
        categories.push(selectedCaste);  // No class or gender considered
        categories.push('UR/X/OP');
        return categories;  // Exit early since no more categories are needed
    }

    // Special case for FW: add 'FW/OP' only
    if (selectedCaste === 'FW') {
        categories.push('FW/OP');
        categories.push('UR/X/OP');
        return categories;  // Exit early since no other categories are needed
    }

    
    const castes = selectedCaste !== 'UR' ? [selectedCaste, 'UR'] : ['UR'];
    const classes = selectedClass !== 'X' ? [selectedClass, 'X'] : ['X'];
    const genders = selectedGender !== 'OP' ? [selectedGender, 'OP'] : ['OP'];

    // Generate combinations of caste, class, and gender
    castes.forEach(caste => {
        classes.forEach(classType => {
            genders.forEach(gender => {
                const category = `${caste}/${classType}/${gender}`;
                categories.push(category);
            });
        });
    });

    return categories;
}

// Example usage


app.get('/', (req, res) => {
    const instituteTypeQuery = 'SELECT DISTINCT institute_type FROM data_table';
    const cityQuery = 'SELECT DISTINCT city FROM data_table  WHERE year = 2024';
    const collegeNameQuery = 'SELECT DISTINCT college_name FROM data_table  WHERE year = 2024 ORDER BY college_name ASC';
    const yearQuery = 'SELECT DISTINCT year FROM data_table';
    const query = `SELECT DISTINCT branch FROM data_table  WHERE year = 2024`;


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

            const sortedCities = cities.map(row => row.city).sort();

            db.query(collegeNameQuery, (err, collegeNames) => {
                if (err) {
                    console.error('Error fetching college names:', err);
                    return res.status(500).send('Internal Server Error');
                }


                db.query(yearQuery, (err, years) => {
                    if (err) {
                        console.error('Error fetching years:', err);
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
                            cities: sortedCities,
                            years: years.map(row => row.year),
                        
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





app.post('/update-cities', (req, res) => {
    const { institute_types } = req.body;

    if (!institute_types || institute_types.length === 0) {
        return res.json({ cities: [] });
    }

    const placeholders = institute_types.map(() => '?').join(',');
    const query = `SELECT DISTINCT city FROM data_table WHERE institute_type IN (${placeholders}) AND year = 2024`;

    db.query(query, institute_types, (err, results) => {
        if (err) {
            console.error('Error fetching cities:', err);
            return res.status(500).send('Internal Server Error');
        }

        const sortedCities = results.map(row => row.city).sort();

        res.json({ cities: sortedCities });
    });
});


app.post('/update-colleges', (req, res) => {
    const { institute_types, cities } = req.body;

    if (!institute_types || !cities || institute_types.length === 0 || cities.length === 0) {
        return res.json({ colleges: [] });
    }

    const institutePlaceholders = institute_types.map(() => '?').join(',');
    const cityPlaceholders = cities.map(() => '?').join(',');
    const query = `
        SELECT DISTINCT college_name 
        FROM data_table 
        WHERE institute_type IN (${institutePlaceholders}) 
        AND city IN (${cityPlaceholders})
        AND year = 2024
        ORDER BY college_name ASC
    `;

    db.query(query, [...institute_types, ...cities], (err, results) => {
        if (err) {
            console.error('Error fetching colleges:', err);
            return res.status(500).send('Internal Server Error');
        }

        res.json({ colleges: results.map(row => row.college_name) });
    });
});



app.post('/update-branches', (req, res) => {
    const { colleges } = req.body;

    if (!colleges || colleges.length === 0) {
        return res.json({ branches: [] });
    }

    const placeholders = colleges.map(() => '?').join(',');
    const query = `SELECT DISTINCT branch FROM data_table WHERE college_name IN (${placeholders}) AND year = 2024`;

    db.query(query, colleges, (err, results) => {
        if (err) {
            console.error('Error fetching branches:', err);
            return res.status(500).send('Internal Server Error');
        }

        const sortedBranches = results.map(row => row.branch).sort();

        res.json({ branches: sortedBranches});
    });
});



app.get('/generate-categories', (req, res) => {
    const selectedCaste = req.query.caste;
    const selectedClass = req.query.class;
    const selectedGender = req.query.gender;

    // Call the generateCategories function
    const categories = generateCategories(selectedCaste, selectedClass, selectedGender);

    // Send the categories back as JSON
    res.json({ categories });
});



app.post('/search', (req, res) => {
    const rank = parseInt(req.body.rank);
    const selectedCaste = req.body.caste;
    const selectedClass = req.body.class;
    const selectedGender = req.body.gender;
    const selectedCollegeNames = req.body.college_name || [];
    const instituteTypes = req.body.institute_type || [];
    const selectedCities = req.body.city || [];
    //const selectedYear = req.body.year;
    const selectedRound = req.body.round;
    const rankRange = parseInt(req.body.rank_range);
    const domicile = req.body.domicile;
    const sortBy = req.body.sort_by || 'closing_rank';
    const selectedBranches = req.body.branch || [];

    const lowerBound = rank - rankRange;
    const upperBound = rank + rankRange;

    // Prepare queries using arrays and joins
    const branchQuery = selectedBranches.length > 0 ? 
        selectedBranches.map(branch => `'${branch}'`).join(',') : 
        "SELECT DISTINCT branch FROM data_table WHERE year = 2024";

    const instituteTypeQuery = Array.isArray(instituteTypes) ? 
        instituteTypes.map(type => `'${type}'`).join(',') : 
        `'${instituteTypes}'`;

    const cityQuery = Array.isArray(selectedCities) ? 
        selectedCities.map(city => `'${city}'`).join(',') : 
        `'${selectedCities}'`;

    let domicileCondition = '';
    if (domicile === 'AI') {
        domicileCondition = 'AND (domicile = "AI" OR domicile = "PR" OR domicile = "NO")';
    } else if (domicile === 'Y') {
        domicileCondition = 'AND (domicile = "YE" OR domicile = "PR")';
    }

    const selectedCategories = req.body.selectedCategories || [];
    const categories = Array.isArray(selectedCategories) ? selectedCategories : [selectedCategories];

    // Generate default categories if none are selected
    if (categories.length === 0) {
        categories.push(...generateCategories(selectedCaste, selectedClass, selectedGender));
    }

    // Create a condition for the selected categories
    const categoryCondition = categories.length > 0 ? 
        categories.map(cat => `allotted_category = '${cat}'`).join(' OR ') : 
        '';

    // Handle multiple college names
    const collegeNameQuery = selectedCollegeNames.length > 0 ? 
        `college_name IN (${selectedCollegeNames.map(name => `'${name}'`).join(',')})` : 
        '1=1'; 

    // Handle round values
    const roundQuery = selectedRound === 'FIRST&UPGRADE' ? 
        `'FIRST', 'UPGRADE'` : 
        `'${selectedRound}'`;

    // Combined query for performance
    const query = `
        SELECT college_name, institute_type, branch, allotted_category, opening_rank, closing_rank, city, year, round
        FROM data_table
        WHERE closing_rank BETWEEN ? AND ?
        AND (${categoryCondition})
        AND (${collegeNameQuery})
        AND institute_type IN (${instituteTypeQuery})
        AND branch IN (${branchQuery})  
        AND city IN (${cityQuery})
        AND year = 2024
        AND round IN (${roundQuery})
        ${domicileCondition}
    `;

    // Execute the main query
    db.query(query, [lowerBound, upperBound], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Store unique results based on college-branch combination
        const uniqueResults = {};
        results.forEach(row => {
            const key = `${row.college_name}-${row.branch}`;
            if (!uniqueResults[key] || row.closing_rank > uniqueResults[key].closing_rank) {
                uniqueResults[key] = row;
            }
        });

        const finalResults = Object.values(uniqueResults);

        // Fetch all historical data in a single query for the relevant years
        const historicalQuery = `
            SELECT college_name, branch, allotted_category, round, year, opening_rank, closing_rank
            FROM data_table
            WHERE year IN (2022, 2023, 2024)
            AND round IN (${roundQuery})
        `;

        db.query(historicalQuery, (err, historicalRanks) => {
            if (err) {
                console.error('Error fetching historical ranks:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Organize historical ranks by key
            const historicalData = {};
            historicalRanks.forEach(rank => {
                const key = `${rank.college_name}-${rank.branch}-${rank.allotted_category}-${rank.round}-${rank.year}`;
                historicalData[key] = rank;
            });

            // Merge historical data with final results
            finalResults.forEach(result => {
                const key2022 = `${result.college_name}-${result.branch}-${result.allotted_category}-${result.round}-2022`;
                const key2023 = `${result.college_name}-${result.branch}-${result.allotted_category}-${result.round}-2023`;
                const key2024 = `${result.college_name}-${result.branch}-${result.allotted_category}-${result.round}-2024`;

                result.opening_rank_2024 = historicalData[key2024]?.opening_rank || 'N/A';
                result.closing_rank_2024 = historicalData[key2024]?.closing_rank || 'N/A';
                result.opening_rank_2023 = historicalData[key2023]?.opening_rank || 'N/A';
                result.closing_rank_2023 = historicalData[key2023]?.closing_rank || 'N/A';
                result.opening_rank_2022 = historicalData[key2022]?.opening_rank || 'N/A';
                result.closing_rank_2022 = historicalData[key2022]?.closing_rank || 'N/A';
            });

            // Fetch trend ranks for sorting criteria
            db.query(`SELECT college_name, branch, rank_number FROM ranked_list`, (err, trendRanks) => {
                if (err) {
                    console.error('Error fetching trend ranks:', err);
                    return res.status(500).send('Internal Server Error');
                }

                // Map trend ranks for efficient access
                const rankMap = new Map(trendRanks.map(rank => [`${rank.college_name}-${rank.branch}`, rank.rank_number]));

                // Helper function to extract 2024 rank from a formatted string
            // Helper function to extract 2024 rank from a formatted string



                // Sorting based on the selected criteria
                finalResults.sort((a, b) => {
                    let comparisonResult = 0;

                    if (sortBy === 'lastYearTrend') {
                        const keyA = `${a.college_name}-${a.branch}`;
                        const keyB = `${b.college_name}-${b.branch}`;
                        const rankA = rankMap.get(keyA) || Number.MAX_SAFE_INTEGER;
                        const rankB = rankMap.get(keyB) || Number.MAX_SAFE_INTEGER;
                        comparisonResult = rankA - rankB; // Lower rank is higher priority
                    } else if (sortBy === 'closing_rank') {
                        const a2024ClosingRank = a.closing_rank_2024;
                        const b2024ClosingRank = b.closing_rank_2024;
                        comparisonResult = a2024ClosingRank - b2024ClosingRank;
                    } else if (sortBy === 'opening_rank') {
                        const a2024OpeningRank = a.opening_rank_2024;
                        const b2024OpeningRank = b.opening_rank_2024;
                        comparisonResult = a2024OpeningRank - b2024OpeningRank;
                    }

                    return comparisonResult;
                });

                console.log('Filtered and Sorted Results:', finalResults); // Print the final results for debugging
                res.render('results', { results: finalResults });
            });
        });
    });
});





app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

